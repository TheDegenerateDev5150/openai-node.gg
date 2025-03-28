// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../resource';
import * as Core from '../core';

export class Embeddings extends APIResource {
  /**
   * Creates an embedding vector representing the input text.
   */
  create(
    body: EmbeddingCreateParams,
    options?: Core.RequestOptions<EmbeddingCreateParams>,
  ): Core.APIPromise<CreateEmbeddingResponse> {
    const hasUserProvidedEncodingFormat = !!body.encoding_format;
    // No encoding_format specified, defaulting to base64 for performance reasons
    // See https://github.com/openai/openai-node/pull/1312
    let encoding_format: EmbeddingCreateParams['encoding_format'] =
      hasUserProvidedEncodingFormat ? body.encoding_format : 'base64';

    if (hasUserProvidedEncodingFormat) {
      Core.debug('Request', 'User defined encoding_format:', body.encoding_format);
    }

    const response: Core.APIPromise<CreateEmbeddingResponse> = this._client.post('/embeddings', {
      body: {
        ...body,
        encoding_format: encoding_format as EmbeddingCreateParams['encoding_format'],
      },
      ...options,
    });

    // if the user specified an encoding_format, return the response as-is
    if (hasUserProvidedEncodingFormat) {
      return response;
    }

    // in this stage, we are sure the user did not specify an encoding_format
    // and we defaulted to base64 for performance reasons
    // we are sure then that the response is base64 encoded, let's decode it
    // the returned result will be a float32 array since this is OpenAI API's default encoding
    Core.debug('response', 'Decoding base64 embeddings to float32 array');

    return (response as Core.APIPromise<CreateEmbeddingResponse>)._thenUnwrap((response) => {
      if (response && response.data) {
        response.data.forEach((embeddingBase64Obj) => {
          const embeddingBase64Str = embeddingBase64Obj.embedding as unknown as string;
          embeddingBase64Obj.embedding = Core.toFloat32Array(embeddingBase64Str);
        });
      }

      return response;
    });
  }
}

export interface CreateEmbeddingResponse {
  /**
   * The list of embeddings generated by the model.
   */
  data: Array<Embedding>;

  /**
   * The name of the model used to generate the embedding.
   */
  model: string;

  /**
   * The object type, which is always "list".
   */
  object: 'list';

  /**
   * The usage information for the request.
   */
  usage: CreateEmbeddingResponse.Usage;
}

export namespace CreateEmbeddingResponse {
  /**
   * The usage information for the request.
   */
  export interface Usage {
    /**
     * The number of tokens used by the prompt.
     */
    prompt_tokens: number;

    /**
     * The total number of tokens used by the request.
     */
    total_tokens: number;
  }
}

/**
 * Represents an embedding vector returned by embedding endpoint.
 */
export interface Embedding {
  /**
   * The embedding vector, which is a list of floats. The length of vector depends on
   * the model as listed in the
   * [embedding guide](https://platform.openai.com/docs/guides/embeddings).
   */
  embedding: Array<number>;

  /**
   * The index of the embedding in the list of embeddings.
   */
  index: number;

  /**
   * The object type, which is always "embedding".
   */
  object: 'embedding';
}

export type EmbeddingModel = 'text-embedding-ada-002' | 'text-embedding-3-small' | 'text-embedding-3-large';

export interface EmbeddingCreateParams {
  /**
   * Input text to embed, encoded as a string or array of tokens. To embed multiple
   * inputs in a single request, pass an array of strings or array of token arrays.
   * The input must not exceed the max input tokens for the model (8192 tokens for
   * `text-embedding-ada-002`), cannot be an empty string, and any array must be 2048
   * dimensions or less.
   * [Example Python code](https://cookbook.openai.com/examples/how_to_count_tokens_with_tiktoken)
   * for counting tokens. Some models may also impose a limit on total number of
   * tokens summed across inputs.
   */
  input: string | Array<string> | Array<number> | Array<Array<number>>;

  /**
   * ID of the model to use. You can use the
   * [List models](https://platform.openai.com/docs/api-reference/models/list) API to
   * see all of your available models, or see our
   * [Model overview](https://platform.openai.com/docs/models) for descriptions of
   * them.
   */
  model: (string & {}) | EmbeddingModel;

  /**
   * The number of dimensions the resulting output embeddings should have. Only
   * supported in `text-embedding-3` and later models.
   */
  dimensions?: number;

  /**
   * The format to return the embeddings in. Can be either `float` or
   * [`base64`](https://pypi.org/project/pybase64/).
   */
  encoding_format?: 'float' | 'base64';

  /**
   * A unique identifier representing your end-user, which can help OpenAI to monitor
   * and detect abuse.
   * [Learn more](https://platform.openai.com/docs/guides/safety-best-practices#end-user-ids).
   */
  user?: string;
}

export declare namespace Embeddings {
  export {
    type CreateEmbeddingResponse as CreateEmbeddingResponse,
    type Embedding as Embedding,
    type EmbeddingModel as EmbeddingModel,
    type EmbeddingCreateParams as EmbeddingCreateParams,
  };
}
