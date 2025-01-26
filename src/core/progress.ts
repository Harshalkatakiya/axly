import { AxlyRequestConfig } from "./types";

export function setupProgress(config: AxlyRequestConfig) {
  const { onUploadProgress, onDownloadProgress } = config;

  if (onUploadProgress) {
    config.onUploadProgress = (progressEvent) => {
      const percent = Math.round(
        (progressEvent.loaded * 100) / (progressEvent.total || 1),
      );
      onUploadProgress(percent);
    };
  }

  if (onDownloadProgress) {
    config.onDownloadProgress = (progressEvent) => {
      const percent = Math.round(
        (progressEvent.loaded * 100) / (progressEvent.total || 1),
      );
      onDownloadProgress(percent);
    };
  }
}
