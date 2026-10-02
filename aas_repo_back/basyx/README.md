# basyx/ — Eclipse BaSyx 런타임 JAR

이 디렉토리에는 `app/basyxAasenvironmentModule.py` 의 `start_jvm()` 이
JPype 로 JVM 클래스패스에 올리는 JAR 이 들어갑니다.

```python
jar_dir = "./basyx"
all_jars = glob.glob(os.path.join(jar_dir, "*.jar"))
jpype.startJVM(classpath=all_jars)
```

## 필요한 파일

| 파일 | 크기 | 비고 |
|---|---|---|
| `basyx.aasenvironment.component-2.0.0-SNAPSHOT-shaded.jar` | 약 86MB | AASX ↔ JSON 변환에 사용 |

## 왜 git 에 없나

외부 라이브러리 아티팩트이고 86MB 라 클론 용량을 크게 늘립니다.
`.gitignore` 에서 `aas_repo_back/basyx/*.jar` 로 제외했습니다.

## 어떻게 받나

**SNAPSHOT 빌드라 Maven Central 에는 없습니다.** 아래 순서로 확보하세요.

1. **팀 공유본 (권장)** — 사내 공유 드라이브 또는 이 레포의 GitHub Release
   자산에서 받아 이 디렉토리에 그대로 둡니다.
2. **직접 빌드** — [eclipse-basyx/basyx-java-server-sdk](https://github.com/eclipse-basyx/basyx-java-server-sdk)
   에서 `basyx.aasenvironment.component` 모듈을 shaded jar 로 빌드.

파일이 없으면 AASX Import/Export 관련 API 가 JVM 시작 단계에서 실패합니다.
