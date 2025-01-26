import { AxlyClient } from "../core/AxlyClient";

export class FileHelpers {
  constructor(private client: AxlyClient) {}

  async uploadFile(url: string, file: File, config?: AxlyRequestConfig) {
    const formData = new FormData();
    formData.append("file", file);

    return this.client.post(url, formData, {
      ...config,
      contentType: "multipart/form-data",
    });
  }

  async downloadFile(url: string, config?: AxlyRequestConfig) {
    return this.client.request({
      ...config,
      url,
      method: "GET",
      responseType: "blob",
    });
  }
}
