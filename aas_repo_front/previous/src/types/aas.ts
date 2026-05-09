// AAS 모델 타입 정의
export interface AASModel {
  aasmodel_seq: string;
  aasmodel_id: string;
  aasmodel_name: string;
  aasmodel_template_id: string;
  version: string;
  description: string;
  status: string;
  status_nm: string;
  type: string | null;
  category_seq: number;
  category_name: string;
  group_seq: number;
  in_seq: number;
  filename: string;
  mime_type: string;
  aasmodel_img: string;
  create_date: string;
}
