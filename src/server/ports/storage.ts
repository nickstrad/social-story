export interface Storage {
  put(
    key: string,
    data: Buffer | ReadableStream,
    contentType: string
  ): Promise<{ url: string }>
  fetchBuffer(url: string): Promise<Buffer>
  delete(url: string): Promise<void>
}
