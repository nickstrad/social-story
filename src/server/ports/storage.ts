export type StorageRead =
  | {
      status: 200
      stream: ReadableStream<Uint8Array>
      contentType: string
      byteLength: number
      etag: string
    }
  | { status: 304; etag: string }
  | { status: 404 }

export interface Storage {
  put(
    key: string,
    data: Buffer | ReadableStream,
    contentType: string
  ): Promise<{ locator: string }>
  read(locator: string, ifNoneMatch?: string): Promise<StorageRead>
  fetchBuffer(locator: string): Promise<Buffer>
  delete(locator: string): Promise<void>
}
