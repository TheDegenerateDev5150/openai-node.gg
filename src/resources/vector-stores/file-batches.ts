// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../core/resource';
import * as FilesAPI from './files';
import { VectorStoreFilesPage } from './files';
import * as VectorStoresAPI from './vector-stores';
import { APIPromise } from '../../core/api-promise';
import { CursorPage, type CursorPageParams, PagePromise } from '../../core/pagination';
import { buildHeaders } from '../../internal/headers';
import { RequestOptions } from '../../internal/request-options';
import { sleep } from '../../internal/utils/sleep';
import { type Uploadable } from '../../uploads';
import { allSettledWithThrow } from '../../lib/Util';
import { path } from '../../internal/utils/path';

export class FileBatches extends APIResource {
  /**
   * Create a vector store file batch.
   */
  create(
    vectorStoreID: string,
    body: FileBatchCreateParams,
    options?: RequestOptions,
  ): APIPromise<VectorStoreFileBatch> {
    return this._client.post(path`/vector_stores/${vectorStoreID}/file_batches`, {
      body,
      ...options,
      headers: buildHeaders([{ 'OpenAI-Beta': 'assistants=v2' }, options?.headers]),
    });
  }

  /**
   * Retrieves a vector store file batch.
   */
  retrieve(
    batchID: string,
    params: FileBatchRetrieveParams,
    options?: RequestOptions,
  ): APIPromise<VectorStoreFileBatch> {
    const { vector_store_id } = params;
    return this._client.get(path`/vector_stores/${vector_store_id}/file_batches/${batchID}`, {
      ...options,
      headers: buildHeaders([{ 'OpenAI-Beta': 'assistants=v2' }, options?.headers]),
    });
  }

  /**
   * Cancel a vector store file batch. This attempts to cancel the processing of
   * files in this batch as soon as possible.
   */
  cancel(
    batchID: string,
    params: FileBatchCancelParams,
    options?: RequestOptions,
  ): APIPromise<VectorStoreFileBatch> {
    const { vector_store_id } = params;
    return this._client.post(path`/vector_stores/${vector_store_id}/file_batches/${batchID}/cancel`, {
      ...options,
      headers: buildHeaders([{ 'OpenAI-Beta': 'assistants=v2' }, options?.headers]),
    });
  }

  /**
   * Create a vector store batch and poll until all files have been processed.
   */
  async createAndPoll(
    vectorStoreId: string,
    body: FileBatchCreateParams,
    options?: RequestOptions & { pollIntervalMs?: number },
  ): Promise<VectorStoreFileBatch> {
    const batch = await this.create(vectorStoreId, body);
    return await this.poll(vectorStoreId, batch.id, options);
  }

  /**
   * Returns a list of vector store files in a batch.
   */
  listFiles(
    batchID: string,
    params: FileBatchListFilesParams,
    options?: RequestOptions,
  ): PagePromise<VectorStoreFilesPage, FilesAPI.VectorStoreFile> {
    const { vector_store_id, ...query } = params;
    return this._client.getAPIList(
      path`/vector_stores/${vector_store_id}/file_batches/${batchID}/files`,
      CursorPage<FilesAPI.VectorStoreFile>,
      { query, ...options, headers: buildHeaders([{ 'OpenAI-Beta': 'assistants=v2' }, options?.headers]) },
    );
  }

  /**
   * Wait for the given file batch to be processed.
   *
   * Note: this will return even if one of the files failed to process, you need to
   * check batch.file_counts.failed_count to handle this case.
   */
  async poll(
    vectorStoreID: string,
    batchID: string,
    options?: RequestOptions & { pollIntervalMs?: number },
  ): Promise<VectorStoreFileBatch> {
    const headers = buildHeaders([
      options?.headers,
      {
        'X-Stainless-Poll-Helper': 'true',
        'X-Stainless-Custom-Poll-Interval': options?.pollIntervalMs?.toString() ?? undefined,
      },
    ]);

    while (true) {
      const { data: batch, response } = await this.retrieve(
        batchID,
        { vector_store_id: vectorStoreID },
        {
          ...options,
          headers,
        },
      ).withResponse();

      switch (batch.status) {
        case 'in_progress':
          let sleepInterval = 5000;

          if (options?.pollIntervalMs) {
            sleepInterval = options.pollIntervalMs;
          } else {
            const headerInterval = response.headers.get('openai-poll-after-ms');
            if (headerInterval) {
              const headerIntervalMs = parseInt(headerInterval);
              if (!isNaN(headerIntervalMs)) {
                sleepInterval = headerIntervalMs;
              }
            }
          }
          await sleep(sleepInterval);
          break;
        case 'failed':
        case 'cancelled':
        case 'completed':
          return batch;
      }
    }
  }

  /**
   * Uploads the given files concurrently and then creates a vector store file batch.
   *
   * The concurrency limit is configurable using the `maxConcurrency` parameter.
   */
  async uploadAndPoll(
    vectorStoreId: string,
    { files, fileIds = [] }: { files: Uploadable[]; fileIds?: string[] },
    options?: RequestOptions & { pollIntervalMs?: number; maxConcurrency?: number },
  ): Promise<VectorStoreFileBatch> {
    if (files == null || files.length == 0) {
      throw new Error(
        `No \`files\` provided to process. If you've already uploaded files you should use \`.createAndPoll()\` instead`,
      );
    }

    const configuredConcurrency = options?.maxConcurrency ?? 5;

    // We cap the number of workers at the number of files (so we don't start any unnecessary workers)
    const concurrencyLimit = Math.min(configuredConcurrency, files.length);

    const client = this._client;
    const fileIterator = files.values();
    const allFileIds: string[] = [...fileIds];

    // This code is based on this design. The libraries don't accommodate our environment limits.
    // https://stackoverflow.com/questions/40639432/what-is-the-best-way-to-limit-concurrency-when-using-es6s-promise-all
    async function processFiles(iterator: IterableIterator<Uploadable>) {
      for (let item of iterator) {
        const fileObj = await client.files.create({ file: item, purpose: 'assistants' }, options);
        allFileIds.push(fileObj.id);
      }
    }

    // Start workers to process results
    const workers = Array(concurrencyLimit).fill(fileIterator).map(processFiles);

    // Wait for all processing to complete.
    await allSettledWithThrow(workers);

    return await this.createAndPoll(vectorStoreId, {
      file_ids: allFileIds,
    });
  }
}

/**
 * A batch of files attached to a vector store.
 */
export interface VectorStoreFileBatch {
  /**
   * The identifier, which can be referenced in API endpoints.
   */
  id: string;

  /**
   * The Unix timestamp (in seconds) for when the vector store files batch was
   * created.
   */
  created_at: number;

  file_counts: VectorStoreFileBatch.FileCounts;

  /**
   * The object type, which is always `vector_store.file_batch`.
   */
  object: 'vector_store.files_batch';

  /**
   * The status of the vector store files batch, which can be either `in_progress`,
   * `completed`, `cancelled` or `failed`.
   */
  status: 'in_progress' | 'completed' | 'cancelled' | 'failed';

  /**
   * The ID of the
   * [vector store](https://platform.openai.com/docs/api-reference/vector-stores/object)
   * that the [File](https://platform.openai.com/docs/api-reference/files) is
   * attached to.
   */
  vector_store_id: string;
}

export namespace VectorStoreFileBatch {
  export interface FileCounts {
    /**
     * The number of files that where cancelled.
     */
    cancelled: number;

    /**
     * The number of files that have been processed.
     */
    completed: number;

    /**
     * The number of files that have failed to process.
     */
    failed: number;

    /**
     * The number of files that are currently being processed.
     */
    in_progress: number;

    /**
     * The total number of files.
     */
    total: number;
  }
}

export interface FileBatchCreateParams {
  /**
   * A list of [File](https://platform.openai.com/docs/api-reference/files) IDs that
   * the vector store should use. Useful for tools like `file_search` that can access
   * files.
   */
  file_ids: Array<string>;

  /**
   * Set of 16 key-value pairs that can be attached to an object. This can be useful
   * for storing additional information about the object in a structured format, and
   * querying for objects via API or the dashboard. Keys are strings with a maximum
   * length of 64 characters. Values are strings with a maximum length of 512
   * characters, booleans, or numbers.
   */
  attributes?: { [key: string]: string | number | boolean } | null;

  /**
   * The chunking strategy used to chunk the file(s). If not set, will use the `auto`
   * strategy. Only applicable if `file_ids` is non-empty.
   */
  chunking_strategy?: VectorStoresAPI.FileChunkingStrategyParam;
}

export interface FileBatchRetrieveParams {
  /**
   * The ID of the vector store that the file batch belongs to.
   */
  vector_store_id: string;
}

export interface FileBatchCancelParams {
  /**
   * The ID of the vector store that the file batch belongs to.
   */
  vector_store_id: string;
}

export interface FileBatchListFilesParams extends CursorPageParams {
  /**
   * Path param: The ID of the vector store that the files belong to.
   */
  vector_store_id: string;

  /**
   * Query param: A cursor for use in pagination. `before` is an object ID that
   * defines your place in the list. For instance, if you make a list request and
   * receive 100 objects, starting with obj_foo, your subsequent call can include
   * before=obj_foo in order to fetch the previous page of the list.
   */
  before?: string;

  /**
   * Query param: Filter by file status. One of `in_progress`, `completed`, `failed`,
   * `cancelled`.
   */
  filter?: 'in_progress' | 'completed' | 'failed' | 'cancelled';

  /**
   * Query param: Sort order by the `created_at` timestamp of the objects. `asc` for
   * ascending order and `desc` for descending order.
   */
  order?: 'asc' | 'desc';
}

export declare namespace FileBatches {
  export {
    type VectorStoreFileBatch as VectorStoreFileBatch,
    type FileBatchCreateParams as FileBatchCreateParams,
    type FileBatchRetrieveParams as FileBatchRetrieveParams,
    type FileBatchCancelParams as FileBatchCancelParams,
    type FileBatchListFilesParams as FileBatchListFilesParams,
  };
}

export { type VectorStoreFilesPage };
