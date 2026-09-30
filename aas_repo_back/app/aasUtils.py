import re

def clean_id_shorts(obj):
    """
    idShort 및 특정 필드 값에서 허용되지 않는 문자를 밑줄(_)로 변경합니다.
    AAS 사양(정규식: [a-zA-Z][a-zA-Z0-9_]*)을 준수하도록 합니다.
    """
    if isinstance(obj, dict):
        for key, value in obj.items():
            if key in ['idShort', 'type'] and isinstance(value, str):
                # 첫 문자가 숫자인 경우 앞에 'id_'를 추가합니다.
                if value and value[0].isdigit():
                    value = 'id_' + value
                # 허용되지 않는 문자를 '_'로 변경합니다.
                obj[key] = re.sub(r'[^a-zA-Z0-9_]', '_', value)
            else:
                obj[key] = clean_id_shorts(value)
    elif isinstance(obj, list):
        return [clean_id_shorts(item) for item in obj]
    return obj

def clean_aas_metadata(data):
    """
    AAS 메타데이터 전체를 정리하는 함수입니다.
    - administration의 version/revision을 정수형으로 변환합니다.
    - File 요소의 contentType이 비어있을 경우 기본값을 설정합니다.
    - idShort를 정리합니다.
    """
    def _recursive_clean(obj):
        if isinstance(obj, dict):
            if 'originalValue' in obj:
                # modelType이 값을 가지는 요소들인 경우에만 매핑
                if obj.get('modelType') in ['Property', 'MultiLanguageProperty', 'Range', 'File', 'ReferenceElement', 'RelationshipElement']:
                    obj['value'] = obj['originalValue']
                
                # originalValue 키는 스키마에 없으므로 삭제
                del obj['originalValue']

            # administration 정리
            if 'administration' in obj:
                admin = obj['administration']
                if 'version' in admin and isinstance(admin.get('version'), str):
                    admin['version'] = admin['version'].split('.')[0] if admin['version'] else '0'
                if 'revision' in admin and not admin.get('revision'):
                    admin['revision'] = '0'
            
            model_reference_fields_config = {
                'semanticId': 'GlobalReference',
                'isCaseOf': 'ConceptDescription',
                'first': 'GlobalReference',
                'second': 'GlobalReference',
                #'dataSpecification': 'GlobalReference', # 2025.11.17 epxort 오류 원인 발견(주석처리)
                #'unitId': 'GlobalReference', # 2025.11.17 epxort 오류 원인 발견(주석처리)
            }

            for field_name, default_key_type in model_reference_fields_config.items():
                if field_name in obj:
                    field_value = obj[field_name]
                    
                    # None, 빈 문자열, 빈 리스트, 빈 딕셔너리 등은 제거
                    if not field_value:
                        del obj[field_name]
                        continue

                    # semanticId가 빈 객체 {} 인 경우, 유효한 구조로 만들어줍니다.
                    if isinstance(field_value, dict) and not field_value:
                        field_value['type'] = 'ModelReference'
                        field_value['keys'] = []
                        obj[field_name] = field_value

                    if isinstance(field_value, str):
                        ref_value = field_value.strip()
                        if ref_value:
                            obj[field_name] = {
                                "type": "ModelReference",
                                "keys": [{"type": default_key_type, "value": ref_value}]
                            }
                        else:
                            del obj[field_name] # 빈 문자열이면 제거
                    elif isinstance(field_value, dict):
                        keys = field_value.get("keys")
                        if isinstance(keys, list) and keys:
                            # 키 목록이 비어있지 않은지 확인하고, 각 키의 유효성을 검사합니다.
                            valid_keys = []
                            for key_entry in keys:
                                if isinstance(key_entry, dict) and key_entry.get("value"):
                                    if field_name == 'isCaseOf' and key_entry.get('type') != 'ConceptDescription':
                                        key_entry['type'] = 'ConceptDescription'
                                    valid_keys.append(key_entry)
                            
                            if valid_keys:
                                obj[field_name]['keys'] = valid_keys
                            else:
                                # first, second는 필수 속성이므로 빈 값이라도 유지
                                if field_name in ['first', 'second']:
                                    obj[field_name]['keys'] = []
                                else:
                                    del obj[field_name] # 유효한 키가 없으면 제거
                        else: # 'keys'가 없거나 비어 있으면 제거
                            # first, second는 필수 속성이므로 빈 값이라도 유지
                            if field_name in ['first', 'second']:
                                if 'keys' not in obj[field_name]:
                                    obj[field_name]['keys'] = []
                            else:
                                del obj[field_name]
                    elif isinstance(field_value, list): # isCaseOf가 리스트일 경우
                        if field_name == 'isCaseOf' and field_value:
                             # 리스트의 각 항목을 ModelReference로 변환
                            new_is_case_of = []
                            for item in field_value:
                                if isinstance(item, dict) and item.get('keys'):
                                    # 이미 ModelReference 형식인 경우
                                    new_is_case_of.append(item)
                                elif isinstance(item, str) and item.strip():
                                    # 문자열인 경우 ModelReference로 변환
                                    new_is_case_of.append({
                                        "type": "ModelReference",
                                        "keys": [{"type": "ConceptDescription", "value": item.strip()}]
                                    })
                            if new_is_case_of:
                                obj[field_name] = new_is_case_of
                            else:
                                del obj[field_name]
                        else:
                            del obj[field_name]
                    else: # 그 외의 경우 (예: 숫자)는 유효하지 않으므로 제거
                        del obj[field_name]

            # KETI 검증을 위해 내부용 'submodel_seq' 키 제거 ▼▼▼
            if obj.get('modelType') == 'Submodel' and 'submodel_seq' in obj:
                del obj['submodel_seq']

            # AASd-129: kind가 TemplateQualifier를 포함하면 'Template'이어야 합니다.
            if obj.get('modelType') != 'Submodel' and 'kind' in obj:
                del obj['kind']

            # 2. Submodel인 경우에만 AASd-129 로직 적용
            if obj.get('modelType') == 'Submodel':
                # kind가 명시되지 않았고, TemplateQualifier도 없다면 기본값 Instance 설정
                if 'kind' not in obj:
                     has_template_qualifier = False
                     if 'qualifiers' in obj and isinstance(obj['qualifiers'], list):
                         has_template_qualifier = any(q.get('type') == 'TemplateQualifier' for q in obj['qualifiers'])
                     
                     if has_template_qualifier:
                         obj['kind'] = 'Template'
                     else:
                         obj['kind'] = 'Instance'

                # 만약 kind가 'Instance'라면, 'TemplateQualifier'는 존재해선 안 됩니다. 제거합니다.
                if obj.get('kind') == 'Instance' and 'qualifiers' in obj and isinstance(obj['qualifiers'], list):
                    obj['qualifiers'] = [q for q in obj['qualifiers'] if q.get('type') != 'TemplateQualifier']
                    if not obj['qualifiers']:
                        del obj['qualifiers']

            # AASd-014: CoManagedEntity에서는 globalAssetId 또는 specificAssetId를 설정할 수 없습니다.
            if obj.get('modelType') == 'Entity' and obj.get('entityType') == 'CoManagedEntity':
                if 'globalAssetId' in obj:
                    del obj['globalAssetId']
                # specificAssetId는 SpecificAssetId의 목록이므로 해당 키를 확인하고 제거합니다.
                if 'specificAssetIds' in obj and isinstance(obj['specificAssetIds'], list):
                    del obj['specificAssetIds']
                elif 'specificAssetIds' in obj and not obj['specificAssetIds']: # None이거나 비어 있으면 제거합니다.
                    del obj['specificAssetIds']


            # File contentType의 기본값을 설정합니다.
            if obj.get('modelType') == 'File' and not obj.get('contentType'):
                obj['contentType'] = 'application/octet-stream'
            
            # LangStringTextType 필드(description, preferredName, shortName, definition)를 처리합니다.
            # 일반적으로 {language: string, text: string} 형식의 배열입니다.
            lang_string_fields_config = {
                'description': {'max_len': None, 'default_text': 'Default description'},
                'preferredName': {'max_len': None, 'default_text': 'Default preferred name'},
                'shortName': {'max_len': 18, 'default_text': 'Default short name'}, 
                'definition': {'max_len': None, 'default_text': 'Default definition'},
                'displayName': {'max_len': None, 'default_text': 'Default display name'},
            }

            for field_name, config in lang_string_fields_config.items():
                if field_name in obj:
                    field_value = obj[field_name]
                    # 문자열인 경우 리스트로 변환
                    if isinstance(field_value, str):
                        obj[field_name] = [{'language': 'en', 'text': field_value.strip() or ' '}]
                        field_value = obj[field_name]

                    if isinstance(field_value, list):
                        cleaned_entries = []
                        has_english = False
                        for entry in field_value:
                            # entry가 딕셔너리인지, text 키가 있는지 안전하게 확인
                            if isinstance(entry, dict) and 'language' in entry:
                                lang = entry['language'].strip().lower()
                                # text 키가 없거나 None이면 빈 문자열로 처리
                                raw_text = entry.get('text')
                                text = raw_text.strip() if raw_text and isinstance(raw_text, str) else ""

                                # 기본적인 BCP47 유효성 검사를 수행하고 유효하지 않은 경우 'en'으로 기본 설정합니다.
                                if not re.match(r'^[a-z]{2}(-[a-z]{2})?$', lang):
                                    lang = 'en'

                                # 텍스트가 너무 길면 자릅니다.
                                if config['max_len'] and len(text) > config['max_len']:
                                    text = text[:config['max_len']]

                                # 텍스트가 비어 있지 않은지 확인합니다. (비어있으면 공백 한 칸 할당)
                                if not text:
                                    text = ' '

                                cleaned_entries.append({'language': lang, 'text': text})
                                if lang == 'en':
                                    has_english = True
                        
                        # 목록이 비어 있지 않거나 비어 있었던 경우 최소한 하나의 영어 항목이 있는지 확인합니다.
                        if not has_english:
                            # 누락되었거나 목록이 비어 있는 경우 기본 영어 항목을 추가합니다.
                            default_text = config['default_text']
                            if config['max_len'] and len(default_text) > config['max_len']:
                                default_text = default_text[:config['max_len']]
                            cleaned_entries.append({'language': 'en', 'text': default_text})
                        
                        obj[field_name] = cleaned_entries
                elif field_name in obj and not obj[field_name]: # 필드가 존재하지만 비어 있거나 None인 경우 기본 영어 항목을 보장합니다.
                    default_text = config['default_text']
                    if config['max_len'] and len(default_text) > config['max_len']:
                        default_text = default_text[:config['max_len']]
                    obj[field_name] = [{'language': 'en', 'text': default_text}]

            # Property 값 형식(double, dateTime) 자동 수정
            if obj.get('modelType') == 'Property':
                value_type = obj.get('valueType')
                value = obj.get('value')
                
                if isinstance(value, str):
                    # (Fix) xs:double 등 숫자 타입인데 쉼표(,)가 포함된 경우
                    if value_type in ('xs:double', 'xs:float', 'xs:int', 'xs:integer', 'xs:long', 'xs:short'):
                        obj['value'] = value.replace(',', '')
                    
                    # (Fix) xs:dateTime인데 'T'가 없는 날짜 형식일 경우 (e.g., "2021-01-01")
                    elif value_type == 'xs:dateTime' and 'T' not in value and re.match(r'^\d{4}-\d{2}-\d{2}$', value.strip()):
                        obj['value'] = f"{value.strip()}T00:00:00Z" # 표준 형식으로 변환

            # SubmodelElementList에 valueTypeListElement 보장 (AASd-109)
            if obj.get('modelType') == 'SubmodelElementList':
                # valueTypeListElement가 아예 없는 경우
                if obj.get('valueTypeListElement') == 'SubmodelElement':
                    del obj['valueTypeListElement']
                
                # 'value'의 idShort 제거 (기존 로직)
                if 'value' in obj and isinstance(obj['value'], list) and obj['value']: 
                    for element in obj['value']:
                        if isinstance(element, dict) and 'idShort' in element:
                            del element['idShort']

            # if obj.get('modelType') == 'SubmodelElementCollection' and 'allowDuplicates' in obj:
            #     del obj['allowDuplicates']

            # 프론트엔드용 'fileObject' 속성 제거
            if 'fileObject' in obj:
                del obj['fileObject']


            # embeddedDataSpecifications를 정리합니다.
            if 'embeddedDataSpecifications' in obj:
                for eds in obj['embeddedDataSpecifications']:
                    if 'dataSpecificationContent' in eds:
                        content = eds['dataSpecificationContent'] # content 변수 사용

                        # IEC61360 스키마 규격에 맞게 valueType을 dataType으로 변환
                        if 'valueType' in content:
                            content['dataType'] = content['valueType']
                            del content['valueType']

                        if 'value' in content and not content['value']:
                            content['value'] = ' ' 
                        
                        if 'valueFormat' in content and not content['valueFormat']:
                            content['valueFormat'] = ' '

                        # 'symbol' 필드 빈 값 오류 수정
                        if 'symbol' in content and not content['symbol']:
                            content['symbol'] = ' '

            
            # Identifiable이 아닌 요소에서 'id' 필드 제거
            # AAS, Submodel, ConceptDescription은 id가 필수이므로 제외하고
            # 나머지(Property, File, SMC 등)는 id가 있으면 안 됩니다.
            if 'id' in obj and obj.get('modelType') not in ['AssetAdministrationShell', 'Submodel', 'ConceptDescription']:
                del obj['id']

            
            for key, value in obj.items():
                _recursive_clean(value)
        
        elif isinstance(obj, list):
            for item in obj:
                _recursive_clean(item)
    
    _recursive_clean(data)

    # idShort를 정리합니다 (전체 객체에 대해).
    cleaned_data = clean_id_shorts(data)
    return cleaned_data


def clean_empty_structures(obj):
    """
    AAS JSON 내에서 의미 없는 빈 구조를 제거합니다.
    - embeddedDataSpecifications: [{}]를 제거합니다.
    - keys가 비어 있으면 전체 항목을 제거합니다.
    - "dataSpecification"이 없으면 제거합니다.
    """
    if isinstance(obj, dict):
        cleaned = {}
        for k, v in obj.items():
            # semanticId와 같은 Reference 타입 객체 처리.
            # is_reference_type = k in ['semanticId', 'first', 'second', 'dataSpecification', 'unitId'] or \ # 2025.11.17 epxort 오류 원인 발견(임시 주석처리)
            is_reference_type = k in ['semanticId', 'first', 'second'] or \
                                (isinstance(v, dict) and v.get('modelType') == 'ReferenceElement')

            if is_reference_type and isinstance(v, dict):
                # v가 빈 딕셔너리 {} 이거나, 'keys' 속성이 없는 경우
                if not v or 'keys' not in v:
                    # 'keys'가 비어있는 유효한 ModelReference로 만들어주거나, 필드를 제거할 수 있습니다.
                    # 여기서는 빈 keys 배열을 추가하여 유효한 구조로 만듭니다.
                    v['type'] = v.get('type', 'ModelReference')
                    v['keys'] = v.get('keys', [])

            # embeddedDataSpecifications를 처리합니다.
            if k == "embeddedDataSpecifications" and isinstance(v, list):
                filtered_list = []
                for item in v:
                    if isinstance(item, dict):
                        # "dataSpecification"이 없으면 제거합니다.
                        if "dataSpecificationContent" in item and "dataSpecification" not in item:
                            continue

                        # "dataSpecification"이 있지만 keys가 없는 경우도 제거합니다.
                        ds = item.get("dataSpecification")
                        if isinstance(ds, dict) and not ds.get("keys"):
                            continue

                        filtered_list.append(clean_empty_structures(item))
                if not filtered_list or filtered_list == [{}]: # 리스트가 비었거나 [{}]만 포함된 경우
                    continue
                cleaned[k] = filtered_list
                continue

            # valueList가 비어있거나 valueReferencePairs가 없는 경우 제거합니다.
            if k == "valueList":
                if isinstance(v, dict) and ("valueReferencePairs" not in v or not v["valueReferencePairs"]):
                    continue
                if not v: # 비어있는 리스트([])나 빈 딕셔너리({})인 경우
                    continue

            cleaned_v = clean_empty_structures(v)

            # [{}] 제거
            if isinstance(cleaned_v, list) and cleaned_v == [{}]:
                continue

            cleaned[k] = cleaned_v
        return cleaned
    elif isinstance(obj, list):
        return [clean_empty_structures(item) for item in obj]
    else:
        return obj


def clean_aas_data(data):
    """
    AAS JSON 데이터를 탐색하여 AASX 표준에 위배되는 빈 객체를 모두 삭제.
    """
    if isinstance(data, dict):
        if "valueList" in data:
            val_list = data["valueList"]
            if isinstance(val_list, dict):
                if "valueReferencePairs" not in val_list or not val_list["valueReferencePairs"]:
                    del data["valueList"]

        for ref_key in ["valueId", "semanticId"]:
            if ref_key in data:
                ref_val = data[ref_key]
                if isinstance(ref_val, dict):
                    if "keys" not in ref_val or not ref_val["keys"]:
                        del data[ref_key]

        for key in list(data.keys()):
            if key in data:
                clean_aas_data(data[key])
                
    elif isinstance(data, list):
        for item in data:
            clean_aas_data(item)
            
    return data