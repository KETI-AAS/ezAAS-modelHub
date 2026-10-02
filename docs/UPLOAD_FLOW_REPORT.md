# Template Migration Upload Flow Report
> **최종 검증일**: 2026-04-02
> **검증 방법**: 실제 소스코드 직접 분석 (추측 없음)
> **대상 브랜치**: ezmodelhub_3th

---

## 1. 문서 목적

이 문서는 Hub의 `AAS Template`, `Submodel Template`, `Instance` 업로드/저장/배포 흐름을 **코드 기준**으로 분석해서 다음 내용을 정리한다.

- 어떤 화면/엔드포인트를 타는지
- 어느 시점에 어떤 DB 테이블에 `insert` 또는 `update`가 일어나는지
- `import`, `draft save`, `publish`, `instance save`가 각각 무엇을 하는지
- **마이그레이션 코드를 새로 만들 때 무엇을 그대로 재사용해야 UI와 동일한 결과가 나오는지**
- 코드에서 발견된 버그와 주의 사항

---

## 2. 실행 환경과 대상 DB

백엔드는 `APP_ENV` 값에 따라 설정 파일을 다르게 로드한다.

```python
# config/config.py
_ENV_FILE_MAP = {
    'local': 'config.local.yaml',
    'prod':  'config.prod.yaml',
}
```

- `APP_ENV=local` → `config.local.yaml`
- `APP_ENV=prod`  → `config.prod.yaml`
- 환경변수가 없으면 `RuntimeError` 발생 (기본값 없음)

### 운영 DB 설정 (`config.prod.yaml`)

```yaml
postgres:
  host: postgres        # docker-compose 서비스명
  port: 5432
  username: postgres
  password: CHANGE_ME_SECRET
  database: postgres

file:
  fullpath: /home/datalake/aas_files/aas   # 파일시스템 절대경로 (서버용)
  mainpath: /aas_files/aas                  # DB 저장용 prefix (URL 경로)
```

### 로컬 DB 설정 (`config.local.yaml`)

```yaml
postgres:
  host: localhost
  port: 5432
  username: postgres
  password: postgres
  database: ezmodel-hub

file:
  fullpath: /home/datalake/aas_files/aas   # ⚠️ 운영과 동일한 Linux 경로!
  mainpath: /aas_files/aas
```

> **⚠️ 주의**: `config.local.yaml`의 `file.fullpath`가 운영과 동일한 Linux 경로로 설정되어 있다.
> Windows 로컬에서 실행하면 파일 저장 시 해당 경로가 없어 `FileNotFoundError`가 발생한다.
> **Migration 실행 전 반드시 config의 `fullpath`를 실제 접근 가능한 경로로 수정해야 한다.**

---

## 3. 큰 흐름 요약

Hub에서 Template을 올리는 흐름은 크게 4단계다.

```
import → draft save → publish → (instance에서 선택)
```

**중요한 점:**

- `import` 단계는 파싱과 기본 검증만 한다. DB insert 없음.
- 실제 DB 저장은 `save` 단계에서 일어난다.
- `instance`에서 선택 가능한 것은 `published` 상태뿐이다.
- **`temporary`와 `draft`는 Submodel에서만 구분된다. AAS는 코드 버그로 둘 다 `draft`로 저장된다. (섹션 5.1 참조)**
- Migration도 `draft save → publish` 를 반드시 따라야 한다.

---

## 4. 엔티티별 의미

### 4.1 AAS Template

상위 AAS 메타데이터 묶음이다.

- **저장 테이블**: `aasrepo.aasmodels`
- 주요 식별자:
  - `aasmodel_seq` (PK, 시퀀스 자동 생성)
  - `aasmodel_id` (AAS 표준 ID, 중복 불가)
  - `aasmodel_template_id` (publish 시 `aasrepo.generator_code()`로 생성)
  - `status` (`temporary` | `draft` | `published` | `deprecated`)
  - `version` (publish 시 0.1씩 증가)
- 추가 컬럼 (문서 미기재):
  - `asset_type` (AssetKind 등)
  - `aas_maturity_level` (성숙도 레벨)
  - `creator` (조직/사람 이름, AAS 표준 필드)
  - `source_project` (출처 프로젝트)
  - `guide_filename`, `guide_mimetype`, `guide_realpath` (가이드 PDF)

### 4.2 Submodel Template

재사용 가능한 submodel 메타데이터다.

- **저장 테이블**: `aasrepo.submodels`
- 주요 식별자:
  - `submodel_seq` (PK)
  - `submodel_id` (AAS 표준 ID)
  - `submodel_semantic_id` (semanticId.keys[0].value, import 단계에서 추출)
  - `submodel_template_id` (publish 시 `aasrepo.generator_code()`로 생성)
  - `status`, `submodel_version`
- 추가 컬럼 (문서 미기재):
  - `creator`
  - `submodel_type` (NULL로 저장됨, save SQL 확인)
  - `guide_filename`, `guide_mimetype`, `guide_realpath`

### 4.3 Instance

실제 운용용 조합이다. AAS template 1개 + submodel 여러 개.

- **저장 테이블**:
  - `aasrepo.aasinstance` (메인)
  - `aasrepo.aasinstance_aasmodels` (AAS relation, 메타데이터 snapshot 포함)
  - `aasrepo.aasinstance_aasmodel_submodels` (Submodel relation, 메타데이터 snapshot 포함)
  - `aasrepo.aasinstance_attachments`
- 삭제: **soft delete** (`is_del = 'Y'`, 물리 삭제 없음)
- **Submodels는 최소 1개 이상 필수** (`len(submodels) == 0`이면 400 반환)

**중요:**
- template 단계에서는 AAS와 submodel이 DB FK로 직접 연결되지 않는다.
- instance를 만들 때 비로소 relation 테이블에 실제 연결이 생긴다.
- instance 저장 시 메타데이터를 **snapshot** 형태로 relation 테이블에도 저장한다.
- `kind = "Template"` → `"Instance"`로 강제 변환 후 저장한다.

---

## 5. 프론트엔드 기준 업로드 흐름

### 5.1 Import 단계

프론트는 파일 업로드 시 다음 API를 호출한다.

```
POST /basyx/{modelType}/import
```
- `modelType`: `aasmodel` 또는 `submodel`
- 반환: `{ metadata, attachments }` (attachments는 Base64 + MIME type)

### 5.2 Save 단계

프론트는 `FormData`를 만들어 전송한다.

| 필드 | 타입 | 설명 |
|---|---|---|
| `body` | JSON bytes | 전체 payload JSON |
| `image` | UploadFile (optional) | 썸네일 이미지 |
| `attachments` | list[UploadFile] (optional) | 첨부파일 목록 |
| `guide_pdf` | UploadFile (optional) | 가이드 PDF |
| `delete_guide` | bool (Form, default=False) | 기존 guide 삭제 여부 |

**엔드포인트:**

| Type | Temporary | Draft |
|---|---|---|
| AAS | `POST /aasmodel/temporary/data` | `POST /aasmodel/draft/data` |
| Submodel | `POST /submodel/temporary/data` | `POST /submodel/draft/data` |

> **⚠️ 코드 버그 발견 (router/aasmodel.py:79-87)**
> AAS의 `POST /aasmodel/temporary/data` 라우터가 `is_temporary=False`를 전달하고 있다.
> 즉 **AAS temporary 엔드포인트도 실제로는 draft 저장**으로 동작한다.
> Submodel temporary는 정상적으로 `is_temporary=True`를 전달한다.
> **Migration 시에는 이 버그를 무시하고, AAS/Submodel 모두 draft save로 진행하면 된다.**

```python
# router/aasmodel.py:79-87 (버그)
return await aasmodelSaveEvent(
    ...
    is_temporary = False,  # ← 버그: temporary 라우터인데 False 전달
    ...
)

# router/aassubmodel.py:67-74 (정상)
return await aasSubModelSaveEvent(
    ...
    is_temporary=True,  # ← 정상
    ...
)
```

### 5.3 Publish 단계

배포 화면에서 draft를 선택하고 `POST /published/data` 호출.

**publish body 필수 필드:**
```json
{
  "target_seq": 123,
  "ty": "aasmodel",
  "status": "draft",
  "version": "0.0",
  "description": "...",
  "target_name": "...",
  "tmp_seman_id": "",
  "category_seq": 456
}
```

> 문서 이전 버전에는 publish body 구조가 명시되어 있지 않았음.

---

## 6. Import 단계 상세 분석

### 6.1 AAS Import

**라우터**: `router/aasBasyx.py`
**함수**: `app/basyxAasenvironmentModule.py::aasModelImportEvent()`

**처리 흐름:**

1. `.json` 파일 → Python 직접 파싱
2. `.aasx` 파일 → **JPype + BaSyx Java** 파서 사용
   (`AasEnvironmentApiHTTPController.parseAASXFile()`)
3. `clean_aas_metadata()` 적용 (빈 text 보정 등)
4. `clean_empty_structures()` 적용 (빈 배열/객체 제거)
5. AAS ID 중복 체크 (`duplicateAasmodelIdCheckEvent`)
6. AASX의 경우 첨부파일 추출 (`extractAttachments()`)
7. 반환: `{ metadata: dict, attachments: { filename: { content: base64, type: mimetype } } }`

**중요 (문서 미기재):**
- Import 단계에서 `clean_aas_metadata` + `clean_empty_structures` 모두 적용됨
- AASX 파싱은 JPype(Java Bridge)를 사용하므로 JVM 기동이 필요함
- AASX는 비동기 대기 로직 포함 (최대 2초 polling)

**DB 작업 없음.**

### 6.2 Submodel Import

통합 라우터: `POST /basyx/submodel/import` (동일 함수 `aasModelImportEvent`, `modelType='submodel'`)

**처리 흐름:**

1. JSON/AASX 파싱 (AAS와 동일)
2. `clean_aas_metadata()` + `clean_empty_structures()` 적용
3. `submodels[0].id` → `submodel_id` 추출
4. `submodels[0].semanticId.keys[0].value` → `semantic_id_value` 추출 (없으면 400)
5. submodel_id 중복 체크 (`duplicateSubModelIdCheckEvent`)
6. 반환: `{ metadata: dict, attachments: { ... } }`

**DB 작업 없음.**

---

## 7. Save 단계 상세 분석

### 7.1 AAS Save (`aasmodelSaveEvent`)

**파일**: `app/aasModelModule.py`

#### 7.1.1 Draft Save 사전 처리 (is_temporary=False 시)

1. `body["metadata"]` 파싱
2. `clean_aas_metadata()` 적용
3. `clean_empty_structures()` 적용
   **⚠️ AAS는 두 함수 모두 적용, Submodel은 clean_aas_metadata만 적용 (차이 있음)**
4. **KETI 검증 API 호출** (`verificationEvent()`)
   - 엔드포인트: `GET {keti_api.url}/verification/template`
   - 타임아웃: 30초
   - **KETI API 미접근 시 save 실패**
   - 검증 결과: `validations` 테이블에 INSERT (target_seq는 최초 save 시 NULL)
5. 성공 조건: `result in ['ok', 'success']` 또는 `"PERFECT" in data`

#### 7.1.2 중복 체크

```python
# 최초 등록 시 (version=="" and aasmodel_seq=="")
if await duplicateAasmodelIdCheckEvent(aasmodel_id, aasmodel_seq):
    return 400 # 중복
```

기존 temporary/draft 있으면 해당 seq 재사용:
```sql
select aasmodel_seq
FROM aasrepo.aasmodels
where aasmodel_id = {aasmodel_id}
    and status in ('temporary', 'draft')
limit 1
```

#### 7.1.3 메인 테이블 저장

```sql
INSERT INTO aasrepo.aasmodels (
    aasmodel_seq, aasmodel_name, aasmodel_id,
    aasmodel_template_id,  -- save 시에는 NULL 또는 기존값 유지
    version, type,
    category_seq, description,
    status,                -- 'temporary' 또는 'draft'
    metadata_aaset_administration_shells,  -- JSONB
    metadata_submodels,                    -- JSONB
    metadata_concept_descriptions,         -- JSONB
    creator,
    asset_type, aas_maturity_level,
    create_user_seq, create_date
)
ON CONFLICT (aasmodel_seq) DO UPDATE SET ...
```

> `aasmodel_template_id`는 save 시 NULL 또는 기존값. **publish 시에 비로소 generator_code()로 채번.**

#### 7.1.4 이미지 처리

```sql
-- 이미지 있으면
INSERT INTO aasrepo.aasmodel_image (aasmodel_seq, aasmodel_img, filename, mime_type)
ON CONFLICT (aasmodel_seq) DO UPDATE SET ...

-- 이미지 없으면 (기존 이미지 삭제)
DELETE FROM aasrepo.aasmodel_image WHERE aasmodel_seq = ...
```

#### 7.1.5 Draft Save 시 기존 Temporary 삭제

`is_temporary=False`일 때:
```sql
DELETE FROM aasrepo.aasmodels
WHERE status = 'temporary'
    AND aasmodel_id = {aasmodel_id}
```

#### 7.1.6 첨부파일 저장

```sql
INSERT INTO aasrepo.aasmodel_attachments (aasmodel_seq, filename, realpath)
ON CONFLICT (aasmodel_seq, filename) DO UPDATE SET realpath = EXCLUDED.realpath
```

**AAS 파일 경로 규칙 (문서 미기재):**

| | DB realpath | 실제 파일시스템 경로 |
|---|---|---|
| attachment | `{mainpath}/{aasmodel_seq}/{filename}` | `{fullpath}/{aasmodel_seq}/{filename}` |
| guide PDF | `{mainpath}/{aasmodel_seq}/guide/{filename}` | `{fullpath}/{aasmodel_seq}/guide/{filename}` |

> `mainpath` = `/aas_files/aas` (prod), `fullpath` = `/home/datalake/aas_files/aas` (prod)

**첨부파일이 없고 기존 published가 있으면 기존 첨부를 새 seq로 복제.**

#### 7.1.7 Guide PDF 저장

별도 UPDATE 쿼리:
```sql
UPDATE aasrepo.aasmodels
SET guide_filename = %s, guide_mimetype = %s, guide_realpath = %s
WHERE aasmodel_seq = {aasmodel_seq}
```

#### 7.1.8 Validation 기록

```sql
INSERT INTO aasrepo.validations
    (target_type, target_seq, target_id, validation_result, description, status, create_user_seq, create_date)
VALUES ('aasmodel', {seq_or_null}, {aasmodel_id}, {result_json}, '', {status}, {user_seq}, localtimestamp)
```

> **최초 save 시 target_seq = NULL** (DB insert 전에 검증하기 때문)

---

### 7.2 Submodel Save (`aasSubModelSaveEvent`)

**파일**: `app/aasSubModelModule.py`

#### 7.2.1 AAS Save와 다른 점

| 항목 | AAS | Submodel |
|---|---|---|
| clean_aas_metadata | ✅ | ✅ |
| clean_empty_structures | ✅ (draft save 시) | ❌ **미적용** |
| KETI 검증 | draft save 시 | draft save 시 |
| 메타데이터 검증 순서 | clean_aas_metadata → clean_empty_structures → KETI | clean_aas_metadata → KETI |
| attachment 경로 | `{mainpath}/{seq}/{filename}` | `{mainpath}/submodel/{seq}/{filename}` |
| guide 경로 | `{mainpath}/{seq}/guide/{filename}` | `{mainpath}/submodel/{seq}/guide/{filename}` |
| 추가 컬럼 | asset_type, aas_maturity_level | submodel_semantic_id (save 시 그대로 저장) |

**Submodel 파일 경로 규칙 (문서 미기재):**

| | DB realpath | 실제 파일시스템 경로 |
|---|---|---|
| attachment | `{mainpath}/submodel/{submodel_seq}/{filename}` | `{fullpath}/submodel/{submodel_seq}/{filename}` |
| guide PDF | `{mainpath}/submodel/{submodel_seq}/guide/{filename}` | `{fullpath}/submodel/{submodel_seq}/guide/{filename}` |

#### 7.2.2 메인 테이블 저장

```sql
INSERT INTO aasrepo.submodels (
    submodel_seq, submodel_name, submodel_id,
    submodel_semantic_id,  -- import 단계에서 추출한 semanticId.keys[0].value
    submodel_template_id,  -- save 시 NULL 또는 기존값
    submodel_version, submodel_type,  -- submodel_type은 NULL
    category_seq, description,
    status,
    metadata_aaset_administration_shells,
    metadata_submodels,
    metadata_concept_descriptions,
    creator, create_user_seq, create_date
)
ON CONFLICT (submodel_seq) DO UPDATE SET ...
```

> `submodel_template_id`는 publish 시에 비로소 `generator_code()`로 채번.

#### 7.2.3 Submodel 중복 체크 주의 (잠재적 버그)

AAS와 Submodel의 중복 체크 로직이 반대 방향으로 작성되어 있다.

```python
# AAS (정상): seq 제외 → 다른 row에 같은 id 있으면 True (중복)
where aasmodel_id = {id}
    and (aasmodel_seq != {seq} or {seq} = '')

# Submodel (주의): seq 포함 → 같은 row나 전체에서 id 있으면 True (중복)
where submodel_id = {id}
    and (submodel_seq = {seq} or {seq} = '')
```

실제 save 로직에서는 `submodel_seq=""`로 호출하므로 전체 검색 → 정상 동작.
하지만 로직 자체는 AAS와 반대로 작성되어 있으므로 migration 코드에서 재사용 시 주의.

---

## 8. Publish 단계 상세 분석

**라우터**: `router/publish.py`
**함수**: `app/publishModule.py::publishProcessEvent()`

### 8.1 입력 조건

```python
# publishModule.py:240-244
if target_seq == "" or ty == "" or status not in ["draft"]:
    return 400  # status가 반드시 "draft"여야 함

if user_group_seq == 3 or user_group_seq is None:
    return 403  # 일반 사용자 불가
```

> **Migration 실행 user_seq는 반드시 user_group_seq 1 또는 2여야 한다.**

### 8.2 버전 계산

현재 동일 `aasmodel_id`의 모든 버전 중 최대값 + 0.1:
```sql
select max(version::decimal(18,1)) + 0.1 as new_version
from aasrepo.aasmodels
where aasmodel_id = {target_id}
```

> 최초 publish 시 0.0 + 0.1 = 0.1. 두 번째 publish는 0.2.
> **Migration에서 publish 시 이 계산이 자동으로 이뤄진다.**

### 8.3 publish 시 변경 컬럼 (AAS)

```sql
UPDATE aasrepo.aasmodels SET
    status = 'published',
    aasmodel_name = {target_name},
    version = '{new_version}',                               -- 0.1씩 증가
    aasmodel_template_id = aasrepo.generator_code(
        'aasmodel', {category_seq}::varchar,
        '{new_version}',
        '{tmp_seman_id}'                                     -- 기존 template_id 또는 ""
    ),
    description = {description},
    last_mod_user_seq = {user_seq},
    last_mod_date = localtimestamp,
    category_seq = {category_seq}
WHERE aasmodel_seq = {target_seq}
```

### 8.4 publish 시 변경 컬럼 (Submodel)

```sql
UPDATE aasrepo.submodels SET
    status = 'published',
    submodel_name = {target_name},
    submodel_version = '{new_version}',
    submodel_template_id = aasrepo.generator_code(
        'submodel', {category_seq}::varchar,
        '{new_version}',
        '{tmp_seman_id}'
    ),
    description = {description},
    last_mod_user_seq = {user_seq},
    last_mod_date = localtimestamp,
    category_seq = {category_seq}
WHERE submodel_seq = {target_seq}
```

> **`submodel_semantic_id`는 publish 시 변경되지 않는다.**
> (코드 주석: `-- 서브모델 semantic_id 는 받아오는 로직(20250411)`)

### 8.5 publish가 중요한 이유

`instanceModelListEvent` (`aasInstanceModule.py:735-775`)에서 instance 생성 화면 조회 시:
```sql
where a.status in ('published')
```
→ published만 표시됨. migration이 draft까지만 하면 instance 추가 목록에 나타나지 않음.

---

## 9. Instance 저장 상세 분석

**라우터**: `router/aasInstance.py`
**함수**: `app/aasInstanceModule.py::instanceSaveEvent()`

### 9.1 입력 payload 구조

```json
{
  "instance_seq": "",           // 신규는 빈 문자열
  "instance_name": "...",       // 필수
  "description": "...",
  "verification": "...",        // 필수 (초기값은 아무 문자열)
  "aasmodel_seq": 123,          // 필수 (published AAS seq)
  "aasmodel_metadata": "...",   // JSON 문자열
  "submodels": [
    {
      "submodel_seq": 456,
      "submodel_metadata": "..."  // JSON 문자열
    }
  ]
}
```

> **`len(submodels) == 0`이면 400 반환. submodel 최소 1개 필수.**

### 9.2 메타데이터 처리 (저장 전)

1. `aasmodel_metadata` 파싱
2. `assetKind` 강제 변환: `"Template"` → `"Instance"`
3. submodels 배열의 `kind` 강제 변환: `"Template"` → `"Instance"`
4. `clean_aas_metadata()` 적용
5. `clean_empty_structures()` 적용

### 9.3 메인 SQL 처리 순서 (단일 CTE 트랜잭션)

```sql
WITH
ins_instance AS (
    INSERT INTO aasrepo.aasinstance (...) ON CONFLICT DO UPDATE
),
del_aasmodel AS (
    DELETE FROM aasrepo.aasinstance_aasmodels WHERE seq != {new_aasmodel_seq}
),
ins_aasmodel AS (
    INSERT INTO aasrepo.aasinstance_aasmodels (instance_seq, aasmodel_seq, metadata_...) ON CONFLICT DO UPDATE
),
del_submodel AS (...),
ins_submodel AS (
    INSERT INTO aasrepo.aasinstance_aasmodel_submodels (...) ON CONFLICT DO UPDATE
),
del_attachments AS (...),     -- 첨부파일 있을 때만
insert_attachments AS (...)    -- 첨부파일 있을 때만
SELECT instance_seq FROM ins_instance
```

> **모든 관련 테이블이 단일 CTE 내에서 트랜잭션으로 처리됨.**

### 9.4 Instance Attachments 경로 불일치 (중요한 버그)

**DB에 저장되는 realpath:**
```python
# aasInstanceModule.py:617
%s || '/' || ins.instance_seq::text || '/' || f.realpath
# → {mainpath}/{instance_seq}/{filename}
```

**실제 파일이 저장되는 경로:**
```python
# aasInstanceModule.py:645
target_dir = os.path.join(upload_dir, 'instance', str(instance_seq_result))
# → {fullpath}/instance/{instance_seq}/{filename}
```

**DB realpath vs 실제 경로 불일치:**
- DB: `aas_files/aas/{seq}/{filename}`
- 파일시스템: `{fullpath}/instance/{seq}/{filename}`

`etcModule.py::fileListEvent()`에서 보정 로직으로 땜빵 중:
```sql
WHEN att.realpath LIKE '/aas_files/aas/%' AND att.realpath NOT LIKE '%/instance/%'
THEN REPLACE(att.realpath, '/aas_files/aas/', '/aas_files/aas/instance/')
```

> **Migration에서 instance attachment를 처리할 경우 이 경로 불일치를 인지하고 DB realpath를 실제 경로와 맞게 저장해야 한다.**

### 9.5 Instance 저장 후 검증

DB 저장 완료 후 별도로 `aasInstanceMergeVerification()` 호출:
```python
verification_result_data = await aasInstanceMergeVerification(userinfo, rst["data"], aasmodel, submodel_list)

# 결과에 따라 aasinstance.verification 컬럼 UPDATE
UPDATE aasrepo.aasinstance SET verification = '{success/fail}' WHERE instance_seq = {seq}
```
- `validations` 테이블에도 INSERT (target_type='instance')

### 9.6 Instance Merge (merged metadata)

다운로드/상세 조회 시 `aasrepo.fn_instance_merge(instance_seq)` DB 함수로 최종 metadata 생성.
직접 insert된 metadata를 조합하는 것이 아니라 DB 함수를 통해 실시간 merge됨.

---

## 10. Validation 기록 상세

**함수**: `app/etcModule.py::verificationEvent()`

```python
async def verificationEvent(userinfo, metadata, target_type, target_seq, target_id):
    # 1. metadata를 JSON으로 직렬화 → KETI API에 multipart/form-data로 POST
    # 2. 결과 파싱
    # 3. validations 테이블에 INSERT

sql = """
    INSERT INTO aasrepo.validations
        (target_type, target_seq, target_id, validation_result, description, status, create_user_seq, create_date)
    VALUES (%s, %s, %s, %s, '', %s, %s, localtimestamp)
    RETURNING validation_seq;
"""
```

**KETI API 엔드포인트:**
- Template 검증: `POST {keti_api.url}/verification/template`
- Instance 검증: `POST {keti_api.url}/verification/metamodel`
- 운영 URL: `http://te.amrc.kr`

**검증 성공 조건 (복잡):**
```python
# etcModule.py: KETI 응답 → validations 저장 후 반환
if validation_status in ['pass', 'passed', 'success']:
    return {"result": "ok", ...}
if validation_status == 'failed':
    return {"result": "fail", ...}
# 그 외 → "error"

# aasModelModule.py에서 추가 조건 처리
elif rst["result"] in ["ok", "success"] or ("PERFECT" in str(rst.get("data"))):
    pass  # 저장 진행
```

> **"PERFECT"를 data에서 체크하는 로직이 etcModule과 aasModelModule에 분산되어 있음.**
> Migration 코드에서 verificationEvent를 재사용하면 이 복잡한 성공 조건을 자동으로 처리할 수 있다.

---

## 11. 업로드 단계별 DB 작업 정리

| 단계 | 역할 | DB 작업 여부 | 주요 테이블 |
|---|---|---|---|
| import | JSON/AASX 파싱, metadata 정리, attachment 추출, 기본 검증 | **없음** | - |
| save - temporary (Submodel만) | metadata 저장, is_temporary=True | 있음 | `submodels`, `submodel_image`, `submodel_attachments` |
| save - draft (AAS/Submodel) | KETI 검증 + metadata 저장 | 있음 | `aasmodels`/`submodels`, image 테이블, attachments 테이블, **`validations`** |
| publish | draft → published, version 증가, template id 생성 | 있음 | `aasmodels` 또는 `submodels` |
| instance save | published AAS/Submodel 연결, kind 변환, 검증 | 있음 | `aasinstance`, `aasinstance_aasmodels`, `aasinstance_aasmodel_submodels`, `aasinstance_attachments`, **`validations`**, `aasinstance` (verification 컬럼 UPDATE) |

---

## 12. 코드 기준 발견된 문제/위험 요소

### 12.1 [심각] AAS temporary 엔드포인트 버그

- **파일**: `router/aasmodel.py:79`
- **내용**: `POST /aasmodel/temporary/data`가 `is_temporary=False`로 호출 → draft 저장으로 동작
- **Migration 영향**: AAS는 무조건 draft save로 진행하면 됨. temporary로 저장할 필요 없음.

### 12.2 [심각] KETI API 외부 의존성

- **파일**: `app/etcModule.py:54-69`
- **내용**: draft save 시 `http://te.amrc.kr`에 HTTP 호출. 미접근 시 save 실패.
- **Migration 영향**: KETI API 접근 가능 여부 사전 확인 필수. 방화벽 규칙 확인 필요.

### 12.3 [심각] 파일 경로 이중 관리 (DB path vs 파일시스템 path)

- AAS와 Submodel의 attachment/guide 경로 규칙이 다름
- Instance attachment는 DB realpath와 실제 파일 경로가 불일치

### 12.4 [중간] AAS vs Submodel 메타데이터 정제 불일치

- **AAS**: `clean_aas_metadata` + `clean_empty_structures` 모두 적용
- **Submodel**: `clean_aas_metadata`만 적용 (`clean_empty_structures` 누락)
- **Migration 영향**: 각 타입에 맞는 정제를 적용해야 함

### 12.5 [중간] validations.target_seq = NULL (최초 save 시)

- 최초 save 시 KETI 검증을 먼저 하고 DB insert를 나중에 하므로, validations 기록 시 seq를 모름
- 검증 기록과 실제 row가 seq로 매핑되지 않음

### 12.6 [중간] config.local.yaml 파일 경로 문제

- `fullpath`가 운영과 동일한 Linux 경로 → Windows 로컬에서 실행 시 파일 저장 실패

### 12.7 [중간] Publish 권한 제약

- `user_group_seq == 3` (일반 사용자)는 publish 불가
- Migration 실행 계정은 반드시 user_group_seq 1 또는 2이어야 함

### 12.8 [낮음] Instance soft delete

- 삭제는 `is_del = 'Y'`로만 처리. 물리 삭제 없음.
- Migration 재실행 시 `is_del = 'Y'`인 기존 데이터와 이름 충돌 가능성 있음.

### 12.9 [낮음] Submodel 중복 체크 로직 비대칭

- AAS의 `duplicateAasmodelIdCheckEvent`와 로직 방향이 반대
- Migration에서 별도 중복 체크 구현 시 주의

---

## 13. Migration 구현 관점에서의 결론

### 13.1 가능한 방식 비교

#### 방식 A. SQL 직접 적재

장점: 빠름, 구현 단순

단점:
- metadata 정제(`clean_aas_metadata`, `clean_empty_structures`) 누락 가능
- validation 이력 누락
- publish 버전 규칙 누락 (`generator_code()` 반영 누락 가능)
- attachment/guide 파일 저장 로직 재현 필요
- AAS/Submodel 파일 경로 규칙이 다름을 수동으로 구현해야 함

**결론: UI와 동일 보장 불가. 비권장.**

#### 방식 B. 기존 API 호출형 migration

장점: 현재 서비스 동작과 거의 동일, import/save/publish 흐름 재현 가능

단점:
- JWT 토큰 필요 (user_seq 1 또는 2)
- KETI API 의존성
- 대량 처리 시 느릴 수 있음

**결론: 가장 안전한 방식. 소량 migration에 적합.**

#### 방식 C. 백엔드 내부 함수 재사용형 migration (추천)

장점:
- 기존 Python 로직 직접 재사용
- UI와 거의 동일한 결과
- API 오버헤드 없음

단점:
- `userinfo` 객체, `UploadFile`, async 실행 컨텍스트를 맞춰야 함
- `APP_ENV` 설정 필요

**결론: 장기적으로 가장 좋은 방식. migration 전용 userinfo mock 객체 구현 필요.**

### 13.2 반드시 재사용해야 할 기존 로직

| 로직 | 파일/함수 | 재사용 이유 |
|---|---|---|
| AAS metadata 정제 | `app/aasUtils.py::clean_aas_metadata` | AAS 스펙 준수 |
| 빈 구조 제거 | `app/aasUtils.py::clean_empty_structures` | KETI 검증 통과 |
| KETI 검증 | `app/etcModule.py::verificationEvent` | validations 기록 + 복잡한 성공 조건 |
| 파일 경로 생성 | save 함수 내 경로 규칙 | AAS/Submodel/Instance 경로가 다름 |
| Publish 버전 계산 | `app/publishModule.py` SQL | max(version)+0.1 계산 |
| generator_code | DB 함수 (publish SQL 내 사용) | template_id 채번 |

### 13.3 migration 전용 코드가 새로 책임질 부분

1. manifest (엑셀/CSV) 읽기
2. 파일 로드 및 타입 판별
3. mock `userinfo` 객체 생성 (user_seq, user_group_seq, lang_code 포함)
4. 실행 결과 로그 기록
5. 실패 행 별도 처리 (재시도 정책)
6. 환경 설정 (`APP_ENV`, file path) 검증

### 13.4 추천 migration 실행 순서

```
1. manifest 읽기 (엑셀/CSV)
2. APP_ENV, DB 연결, KETI API 접근 확인
3. file.fullpath가 실제 존재하는 경로인지 확인
4. type에 따라:
   [AAS] → draft save (is_temporary=False)
   [Submodel] → draft save (is_temporary=False)
5. save 결과 seq 기록
6. publish 실행 (user_group_seq 1 또는 2 필수)
7. 결과 seq / status / template_id / version 기록
8. 실패 row는 별도 로그에 남김
```

### 13.5 migration 결과 로그 필수 항목

| 항목 | 설명 |
|---|---|
| source_file | 원본 파일명 |
| type | aasmodel / submodel |
| target_id | AAS ID 또는 submodel ID |
| saved_seq | DB에 저장된 seq |
| final_status | draft / published |
| generated_template_id | publish 후 aasmodel_template_id / submodel_template_id |
| version | publish 후 버전 |
| error_message | 실패 시 메시지 |
| validation_status | KETI 검증 결과 |

---

## 14. 개발 전 반드시 결정해야 하는 항목

### 14.1 환경 관련

- [ ] Migration 실행 환경: 로컬 vs 서버 직접 실행
- [ ] `APP_ENV` 설정값
- [ ] `file.fullpath` 경로가 실제로 존재하고 쓰기 가능한지
- [ ] KETI API (`http://te.amrc.kr`) 접근 가능 여부 확인
- [ ] Migration 실행 user_seq (user_group_seq 1 또는 2 확인)

### 14.2 데이터 관련

- [ ] `category_seq` 매핑 규칙: manifest의 카테고리명 → DB `aasrepo.categories`의 seq 매핑
- [ ] KETI 검증 실패 시 정책: 중단 / 건너뜀 / 강제 저장
- [ ] Submodel `submodel_semantic_id` 소스: import 결과에서 자동 추출 vs manifest에서 수동 입력
- [ ] 기존 데이터 중복 처리 정책: 덮어쓰기 / 건너뜀 / 오류

### 14.3 파일 관련

- [ ] AAS와 Submodel의 파일 경로 규칙 차이를 migration 코드에 명시적으로 반영
- [ ] Instance attachments의 DB path 불일치 처리 방식

---

## 15. 대량 마이그레이션 시 장애 포인트

| 포인트 | 설명 | 대응 방안 |
|---|---|---|
| KETI API 타임아웃 | 30초 타임아웃, 서비스 불안정 시 다량 실패 | 재시도 로직, KETI API 상태 사전 확인 |
| DB sequence 채번 | 대량 insert 시 seq 충돌 가능성 | PostgreSQL sequence는 기본적으로 안전하나 확인 필요 |
| 파일시스템 경로 없음 | fullpath 디렉토리 미존재 시 FileNotFoundError | 실행 전 makedirs 확인 |
| category_seq 없음 | categories 테이블에 없는 seq 사용 시 FK 오류 | 사전 카테고리 매핑 테이블 준비 |
| user_seq 없음 | users 테이블에 없는 seq 사용 시 FK 오류 | migration 전용 계정 사전 생성 확인 |
| 중복 aasmodel_id | 이미 published인 동일 ID 존재 시 중복 체크 통과 | `aasmodel_seq != ""`로 기존 row 재사용 분기 처리 |
| AASX JVM 기동 실패 | AASX 파싱 시 JVM 기동 필요 | JSON으로 사전 변환하거나 JVM 환경 사전 준비 |
| guide PDF 파일명 충돌 | 동일 seq에 다른 guide 파일 업로드 시 기존 파일 삭제 | 파일명 기반이 아닌 seq 기반으로 관리 |
| instance submodels 0개 | submodels 빈 배열이면 instance 저장 불가 | manifest에서 submodel 1개 이상 확인 |

---

## 16. 참고: DB에서 사용되는 주요 함수 및 테이블

### 사용되는 DB 함수

| 함수 | 용도 |
|---|---|
| `aasrepo.generator_code(type, category_seq, version, old_id)` | publish 시 template_id 채번 |
| `aasrepo.fn_instance_merge(instance_seq)` | instance 상세/다운로드 시 merged metadata 생성 |
| `aasrepo.fncodenm(code, lang_code, type)` | 언어별 코드명 반환 |
| `aasrepo.fncodelist(type, lang_code, ...)` | 코드 리스트 반환 |

### 조회에 사용되는 추가 테이블

| 테이블 | 용도 |
|---|---|
| `aasrepo.categories` | 카테고리 정보 (FK로 참조, **migration 시 반드시 존재해야 함**) |
| `aasrepo.users` | 사용자 정보 (create_user_seq, last_mod_user_seq FK) |
| `aasrepo.aas_codeinfo` | 카테고리 계층 구조 |
| `aasrepo.validations` | KETI 검증 기록 |

---

## 17. 최종 결론

현재 Hub의 template 업로드는 단순한 DB insert가 아니다.

- **import**: 파싱 + metadata 정제(clean_aas_metadata + clean_empty_structures) 단계
- **draft save**: KETI 검증 → DB insert/update + 파일 저장 단계
- **publish**: draft → published 상태 전환 + version 증가 + template_id 생성 단계
- **instance**: published template/submodel을 relation 테이블로 연결 + kind 변환 + 검증 단계

**핵심 주의사항:**

1. AAS temporary 엔드포인트 버그로 인해 AAS는 무조건 draft save
2. AAS와 Submodel의 파일 경로 규칙이 다름 (경로에 `/submodel/` 포함 여부)
3. AAS draft save 시 `clean_empty_structures` 적용, Submodel은 미적용
4. KETI API는 외부 의존성 → migration 전 접근 가능 여부 확인 필수
5. publish 실행 계정은 user_group_seq 1 또는 2여야 함
6. Instance attachment DB path와 실제 파일시스템 경로가 불일치 (보정 로직 존재)

"UI에서 올린 것과 똑같은 migration"을 원한다면:
- SQL 직접 적재가 아니라
- **기존 import/save/publish 로직을 서비스화한 migration runner**로 작성해야 한다.

---

## 18. 이번 요청 기준 재분석: 빠져 있던 요구사항 정리

이번 요청으로 보면, 이 문서는 단순 업로드 분석 문서에서 끝나면 안 되고, **실제로 개발할 migration 기능의 요구사항 문서**까지 포함해야 한다.

현재 요청에서 추가로 확정된 요구사항은 아래와 같다.

### 18.1 화면 요구사항

- 프론트에 **`/dev/migration` 화면**이 새로 필요하다.
- 화면에는 최소한 아래 입력 UI가 있어야 한다.
  - `template json directory path`
  - `excel file path`
- 이 화면은 일반 업로드 화면(`/aas/ins`, `/submodel/ins`)과 별도이지만, **결과물은 기존 업로드 UI와 동일해야 한다.**

### 18.2 입력 데이터 요구사항

- 엑셀 각 행(row)에는 최소한 다음 정보가 들어간다.
  - 템플릿 JSON 파일명
  - 메타데이터 컬럼들
- 실제 JSON 파일은 사용자가 입력한 directory path 아래에서 찾는다.
- 즉, **엑셀은 “행별 제어 파일”**, JSON 파일은 **실제 템플릿 본문** 역할이다.

### 18.3 실행 방식 요구사항

- 사용자는 한 행씩 수동 업로드하는 것이 아니라, **한 번 실행으로 전체 row를 처리**하고 싶어 한다.
- 따라서 기능 요구사항은 “row 단위 처리”가 아니라 **batch 실행**이다.
- 다만 안전성 측면에서는 내부 구현을 완전 병렬로 단정하면 안 되고, 아래를 분리해서 봐야 한다.
  - 사용 경험: 한 번의 실행으로 전체를 올린다.
  - 내부 처리: 각 row를 순회하면서 결과를 누적 기록한다.

> 현재 코드 구조상 `save`, `publish`, 파일쓰기, 외부 Test Engine 호출이 모두 섞여 있으므로,  
> **“한 번의 배치 실행”과 “무제한 병렬 처리”는 같은 의미가 아니다.**
> 문서상 요구사항은 우선 **한 번의 배치 실행**으로 정리하는 것이 맞다.

### 18.4 Test Engine 필수 경유 요구사항

- 각 템플릿은 migration 시 반드시 **기존 Test Engine 검증 로직**을 지나가야 한다.
- 즉 row 하나의 처리 순서는 다음이어야 한다.
  1. 엑셀 row 메타데이터 준비
  2. JSON 문서 로드
  3. 기존 템플릿 검증 로직(Test Engine) 호출
  4. `ok/success/PERFECT` 계열 성공 조건일 때만
  5. 기존과 동일한 save/publish 로직 수행

이 요구사항 때문에 migration은 **직접 SQL 적재 방식으로 가면 안 된다.**

### 18.5 결과 동일성 요구사항

- migration으로 만들어진 결과물은 이후 기능에서 사용할 예정이므로,
- **기존 UI에서 업로드한 template과 DB 상태, 파일 상태, publish 상태가 동일해야 한다.**
- 따라서 migration 전용 로직이 따로 metadata를 변형하거나, publish를 생략하거나, validation을 우회하면 안 된다.

---

## 19. 이번 요청 기준으로 코드에서 추가 확인한 사항

### 19.1 `/dev/migration` 화면과 전용 API는 현재 없다

현재 코드 기준:

- 프론트에는 `/aas/ins`, `/submodel/ins`, `/distribute/ins`는 있으나
- **`/dev/migration` 페이지는 없다**
- 라우트 상수(`src/constants/routes.ts`)에도 `DEV` 또는 `MIGRATION` 항목이 없다
- 백엔드에도 **path 문자열을 받아서 migration을 수행하는 전용 엔드포인트가 없다**

즉, 이번 요청은 **기존 기능 조합이 아니라 신규 화면 + 신규 실행 진입점 설계**가 필요하다.

### 19.2 이 기능은 프론트 단독 구현으로 끝내기 어렵다

사용자가 원하는 입력은:

- JSON directory path
- Excel file path

인데, 브라우저 프론트는 서버 파일시스템의 임의 경로를 직접 읽을 수 없다.

따라서 `/dev/migration` 화면은 단순 프론트 로직이 아니라:

1. 사용자가 path를 입력하고
2. 백엔드 migration API에 path를 넘기고
3. 백엔드가 해당 경로를 읽어서 batch를 수행하는 구조

여야 한다.

즉, 이번 기능의 본체는 **백엔드 migration runner**다.

### 19.3 프론트는 엑셀 파싱 라이브러리를 이미 갖고 있다

`aas_repo_front/package.json` 기준 `xlsx` dependency가 이미 존재한다.

그래서 기술적으로는 프론트에서 업로드된 Excel 파일을 읽는 것도 가능하다.  
하지만 이번 요구는 “파일 업로드”가 아니라 “경로 입력”이므로, 우선 설계 기준은 **백엔드 path 기반 실행**이 더 자연스럽다.

### 19.4 Test Engine 경유는 기존 draft save 로직을 타면 충족된다

코드 기준:

- AAS: `app/aasModelModule.py::aasmodelSaveEvent(..., is_temporary=False)`
- Submodel: `app/aasSubModelModule.py::aasSubModelSaveEvent(..., is_temporary=False)`

에서 `verificationEvent()`를 호출한다.

즉 migration이 반드시 재사용해야 하는 핵심 지점은:

- `import` 계열 파싱/정제 로직
- `draft save`
- `publish`

이다.

반대로 아래는 금지에 가깝다.

- draft save 없이 DB 직접 insert
- validation 없이 publish
- `temporary`만 만들고 publish 생략

### 19.5 Publish 권한 때문에 migration 실행 계정 조건이 있다

`publishProcessEvent()`는 `user_group_seq == 3`이면 403을 반환한다.

즉 migration 실행 계정은 최소:

- `Manager(1)` 또는
- `Approvedor(2)`

여야 한다.

따라서 `/dev/migration` 화면 접근권한도 최소한 publish 가능한 권한과 동일하게 잡는 것이 맞다.

### 19.6 현재 문서는 AAS/Submodel 업로드 흐름 자체는 둘 다 다루고 있다

기존 문서 자체는 이미:

- AAS import/save/publish
- Submodel import/save/publish

를 모두 분석하고 있다.

즉 **“AAS template, Submodel template 둘 다 기존 시스템에서 어떻게 저장되는가”** 에 대한 기반 분석은 이미 있다.

하지만 migration 기능 기준으로는 아래가 아직 빠져 있었다.

- row별로 어떤 타입인지 자동 판별하는 규칙
- 엑셀 row와 JSON 파일을 어떻게 매핑하는지
- 둘이 섞여 있을 때 batch에서 어떻게 분기하는지
- 실패 row를 어떻게 기록하고 다음 row를 계속할지

즉, **분석 범위는 둘 다 포함하고 있었지만, migration 설계 문서로서는 명시가 부족했다.**

### 19.7 JSON 기반 migration은 attachment 처리 정책을 별도로 정해야 한다

현재 import 로직 기준:

- `.aasx` import는 내부 attachment를 추출한다.
- **plain `.json` import는 attachment를 추출하지 않는다.**

따라서 migration 입력이 “JSON 파일 directory”인 경우에는 다음을 결정해야 한다.

- 정책 A: 현재 UI의 plain JSON import와 똑같이 attachment 없이 처리
- 정책 B: JSON 안의 `modelType == "File"` 경로를 읽어 같은 디렉터리에서 첨부파일을 찾아 함께 업로드

이 항목은 이번 요청에 아직 명시되어 있지 않다.  
하지만 이후 기능에서 template를 실제 사용할 계획이라면 **반드시 결정해야 하는 누락 요구사항**이다.

---

## 20. AAS Template / Submodel Template 판별 로직 제안

질문: **JSON 문서를 보고 AAS template인지, Submodel template인지 판별 가능한가?**

결론부터 말하면 **가능하다. 다만 `submodels` 존재 여부만 보면 안 된다.**

이유:

- AAS template JSON 안에도 `submodels` 배열이 들어간다.
- 따라서 `submodels`가 있다고 해서 Submodel template이라고 판단하면 오판 가능성이 있다.

### 20.1 권장 판별 우선순위

1. 최상위 JSON이 AAS Environment 형식인지 확인  
   - 객체여야 함
   - `assetAdministrationShells`, `submodels`, `conceptDescriptions` 키 구조를 기대

2. `assetAdministrationShells`가 **1개 이상이면 `aasmodel`로 판정**

3. `assetAdministrationShells`가 비어 있고, `submodels`가 **1개 이상**이면 `submodel` 후보로 판정

4. Submodel 후보일 때는 아래를 추가 확인
   - `submodels[0].id` 존재
   - `submodels[0].semanticId.keys[0].value` 존재

5. 아래 경우는 **모호/비정상 입력으로 실패 처리**
   - `assetAdministrationShells`도 없고 `submodels`도 없음
   - `assetAdministrationShells`는 없는데 `submodels`가 여러 개여서 “어느 것을 템플릿으로 볼지” 불명확
   - `submodels[0]`는 있으나 semanticId가 없음

### 20.2 정리된 판별 규칙

| 조건 | 판정 |
|---|---|
| `len(assetAdministrationShells) > 0` | `aasmodel` |
| `len(assetAdministrationShells) == 0` and `len(submodels) > 0` | `submodel` 후보 |
| 둘 다 없음 | 오류 |

**중요:** `submodels` 존재는 AAS에서도 자연스럽기 때문에  
**최종 판별 기준은 `assetAdministrationShells` 우선**이어야 한다.

### 20.3 migration에서 실제 적용 방식

권장 방식:

1. JSON 파일을 먼저 읽는다.
2. 위 판별 규칙으로 `modelType`을 정한다.
3. 그 다음 기존 import/save/publish 로직에 `aasmodel` 또는 `submodel`로 분기 진입한다.

이렇게 하면 **한 개의 batch 안에서 AAS와 Submodel이 섞여 있어도 처리 가능**하다.

---

## 21. 이번 요청 기준으로 문서에 추가되어야 하는 개발 결정사항

아래 항목은 실제 구현 전에 문서에 박아두는 것이 좋다.  
이번 요청 관점에서 “내가 확인하고자 했던 것들”을 정리하면 사실상 이 목록이다.

### 21.1 화면/권한

- [ ] `/dev/migration` 신규 페이지 생성 여부
- [ ] 접근 권한: `Manager/Approvedor`만 허용할지
- [ ] 결과 화면을 단순 toast로 끝낼지, row별 결과 테이블을 둘지

### 21.2 백엔드 실행 방식

- [ ] path 문자열을 받는 migration 전용 API를 만들지
- [ ] 단건 HTTP 요청으로 끝낼지, job 생성 + polling 구조로 갈지
- [ ] 긴 batch에서 HTTP timeout을 어떻게 피할지

> row 수가 많고 Test Engine까지 경유하면 한 번의 요청이 길어질 가능성이 높다.  
> 따라서 설계상으로는 **job 생성형 API + 상태조회 API**가 더 안전하다.

### 21.3 엑셀 스키마

- [ ] 필수 컬럼 정의
  - `template_filename`
  - `target_name`
  - `description`
  - `category_seq` 또는 category 매핑 기준값
- [ ] 선택 컬럼 정의
  - `creator`
  - `asset_type`
  - `aas_maturity_level`
  - `source_project`
  - `guide_pdf_path`
  - `thumbnail_path`
- [ ] AAS 전용 컬럼과 Submodel 공통 컬럼을 어떻게 분리할지

### 21.4 row 처리 정책

- [ ] 한 row 실패 시 전체 중단할지, 실패만 기록하고 다음 row 계속할지
- [ ] 중복 ID 발견 시 정책: 중단 / skip / overwrite
- [ ] publish까지 자동 수행할지, draft까지만 저장 후 검토할지

> 이번 요청 문맥상 사용자는 **자동 publish까지 포함한 완전 migration**을 원하고 있다.

### 21.5 파일 처리 정책

- [ ] JSON 본문 외 첨부파일도 migration 대상에 포함할지
- [ ] guide PDF, thumbnail image를 엑셀 path로 받을지
- [ ] JSON 내부 `File` 참조를 directory 기준으로 해석할지

### 21.6 로그/결과 리포트

- [ ] row별 성공/실패 로그를 어디에 남길지
- [ ] 화면에서 내려받을 결과 CSV/XLSX를 만들지
- [ ] 최소 로그 컬럼:
  - row number
  - template filename
  - detected type
  - draft seq
  - published seq
  - generated template_id
  - validation result
  - error message

---

## 22. 이번 요청 기준 최종 결론

현재 문서는 **기존 업로드/배포 로직 분석 문서로서는 충분히 강하다.**

하지만 이번 요청처럼 실제 개발용 migration 문서로 쓰려면, 아래가 추가로 명시되어야 한다.

1. `/dev/migration` 신규 화면과 권한
2. path 기반으로 실행하는 백엔드 migration runner
3. 엑셀 row + JSON 파일 매핑 규칙
4. AAS/Submodel 자동 판별 규칙
5. Test Engine 필수 경유 규칙
6. batch 실행/실패/로그 정책
7. attachment / guide / image 처리 정책

정리하면:

- **기존 문서는 “현재 시스템이 어떻게 저장되는가”는 잘 설명하고 있다.**
- **이번에 빠져 있던 것은 “그래서 batch migration 기능을 어떤 입출력과 어떤 제약으로 설계해야 하는가”였다.**
- 따라서 migration 구현은 기존 문서를 버리는 것이 아니라,
- **현재 문서 위에 이번 섹션(18~22)의 요구사항/판별/확인 포인트를 얹어서 개발 기준서로 사용**하는 것이 맞다.
