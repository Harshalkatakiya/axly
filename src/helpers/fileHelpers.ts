import { AxlyClient } from "../core/AxlyClient";
import { AxlyRequestConfig, AxlyResponse } from "../core/types";

export class FileHelpers {
  constructor(private client: AxlyClient) {}

  async uploadFile(
    url: string,
    file: File,
    config?: AxlyRequestConfig,
  ): Promise<AxlyResponse> {
    const formData = new FormData();
    formData.append("file", file);

    const response = await this.client.post(url, formData, {
      ...config,
      contentType: "multipart/form-data",
    });

    return response;
  }

  async downloadFile(
    url: string,
    config?: AxlyRequestConfig,
  ): Promise<AxlyResponse<Blob>> {
    const response = await this.client.request<Blob>({
      ...config,
      url,
      method: "GET",
      responseType: "blob",
    });

    return response;
  }
}
