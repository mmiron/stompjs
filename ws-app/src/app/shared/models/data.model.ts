export interface Tag {
  id: number;
  name: string;
  isChecked?: boolean;
}

export interface DataRecordPayload {
  id: number;
  name: string;
  description: string;
  createdAt: string;
  updatedAt?: string;
  tags: Tag[];
}

export type DataRecord = DataRecordPayload;
