export interface ApiResponse<T = unknown> {
  message: string;
  data?: T;
  statusCode?: number;
  success?: boolean;
}
