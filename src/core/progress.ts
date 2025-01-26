import { AxiosProgressEvent } from "axios";
import { AxlyRequestConfig } from "./types";

/**
 * Sets up progress tracking for uploads and downloads
 */
export function setupProgress(config: AxlyRequestConfig) {
  const { onUploadProgress, onDownloadProgress } = config;

  if (onUploadProgress) {
    config.onUploadProgress = (progressEvent: AxiosProgressEvent) => {
      const percent = Math.round(
        (progressEvent.loaded * 100) / (progressEvent.total || 1),
      );
      onUploadProgress(percent); // Now passing percentage instead of full event
    };
  }

  if (onDownloadProgress) {
    config.onDownloadProgress = (progressEvent: AxiosProgressEvent) => {
      const percent = Math.round(
        (progressEvent.loaded * 100) / (progressEvent.total || 1),
      );
      onDownloadProgress(percent); // Now passing percentage instead of full event
    };
  }
}
