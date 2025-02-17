import {Readable} from "stream"
import {basename} from "path"
import {inspect} from "util"

import {Encoder} from "form-data-encoder"

import {File} from "./File"

import {fileFromPathSync} from "./fileFromPath"

import deprecateHeaders from "./util/deprecateHeaders"
import deprecateReadStream from "./util/deprecateReadStream"
import deprecateGetComputedLength from "./util/deprecateGetComputedLength"
import deprecateSymbolAsyncIterator from "./util/deprecateSymbolAsyncIterator"
import deprecateBuffer from "./util/deprecateBuffer"
import deprecateStream from "./util/deprecateStream"

import isFile from "./util/isFile"
import isPlainObject from "./util/isPlainObject"
import isReadStream from "./util/isReadStream"
import getFilename from "./util/getFilename"

const {isBuffer} = Buffer

export type FormDataFieldValue = string | File

type FormDataFieldValues = [FormDataFieldValue, ...FormDataFieldValue[]]

export interface FormDataFieldOptions {
  /**
   * Returns the media type ([`MIME`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/MIME_types)) of the file represented by a `File` object.
   */
  type?: string

  /**
   * The last modified date of the file as the number of milliseconds since the Unix epoch (January 1, 1970 at midnight). Files without a known last modified date return the current date.
   */
  lastModified?: number,

  /**
   * The name of the file.
   */
  filename?: string
}

/**
 * Private options for FormData#_setField() method
 */
interface FormDataSetFieldOptions {
  name: string
  value: unknown
  append: boolean
  filenameOrOptions?: string | FormDataFieldOptions
  options?: FormDataFieldOptions
  argsLength: number
}

/**
 * Constructor entries for FormData
 */
export type FormDataConstructorEntries = Array<{
  name: string,
  value: unknown,
  filename?: string
  options?: FormDataFieldOptions
}>

export class FormData {
  // TODO: Remove this along with FormData#stream getter in 4.x
  #stream!: Readable

  #encoder: Encoder

  /**
   * Returns headers for multipart/form-data
   *
   * @deprecated FormData#headers property is non-standard and will be removed from this package in the next major release (4.x). Use https://npmjs.com/form-data-encoder package to serilize FormData.
   */
  @deprecateHeaders
  get headers() {
    return {
      "Content-Type": `multipart/form-data; boundary=${this.boundary}`
    }
  }

  /**
   * Returns internal readable stream, allowing to read the FormData content
   *
   * @deprecated FormData#stream property is non-standard and will be removed from this package in the next major release (4.x). Use https://npmjs.com/form-data-encoder package to serilize FormData.
   */
  @deprecateStream
  get stream() {
    if (!this.#stream) {
      this.#stream = Readable.from(this)
    }

    return this.#stream
  }

  get boundary(): string {
    return this.#encoder.boundary
  }

  /**
   * Stores internal data for every field
   */
  readonly #content = new Map<string, FormDataFieldValues>()

  constructor(entries?: FormDataConstructorEntries) {
    this.#encoder = new Encoder(this)

    if (entries) {
      entries.forEach(({name, value, filename, options}) => this.append(
        name, value, filename, options
      ))
    }
  }

  #setField({
    name,
    value,
    append,
    filenameOrOptions,
    options,
    argsLength
  }: FormDataSetFieldOptions): void {
    const methodName = append ? "append" : "set"

    name = String(name)

    let filename: string | undefined
    if (isPlainObject(filenameOrOptions)) {
      [options, filename] = [filenameOrOptions, undefined]
    } else {
      filename = filenameOrOptions
    }

    // FormData required at least 2 arguments to be set.
    if (argsLength < 2) {
      throw new TypeError(
        `Failed to execute '${methodName}' on 'FormData': `
          + `2 arguments required, but only ${argsLength} present.`
      )
    }

    // Get a filename from either an argument or options
    filename ||= options?.filename

    // If a value is a file-like object, then get and normalize the filename
    if (isFile(value) || isReadStream(value) || isBuffer(value)) {
      // Note that the user-defined filename has higher precedence
      filename = basename(filename || getFilename(value))
    } else if (filename) { // If a value is not a file-like, but the filename is present, then throw the error
      throw new TypeError(
        `Failed to execute '${methodName}' on 'FormData': `
          + "parameter 2 is not one of the following types: "
          + "ReadStream | Buffer | File | Blob"
      )
    }

    // Normalize field's value
    if (isReadStream(value)) {
      // TODO: Remove ReadStream support in favour of fileFromPath and fileFromPathSync
      value = fileFromPathSync(String(value.path), filename, options)
    } else if (isBuffer(value)) {
      // TODO: Remove Buffer in a field's value support in favour of Blob.
      value = new File([value], filename!, options)
    } else if (isFile(value)) {
      value = new File([value], filename!, {
        ...options,

        // Take params from the previous File or Blob instance
        // But keep user-defined options higher percidence
        type: options?.type || value.type,
        lastModified: options?.lastModified || value.lastModified
      })
    } else {
      // A non-file fields must be converted to string
      value = String(value)
    }

    const values = this.#content.get(name)

    if (!values) {
      return void this.#content.set(name, [value as FormDataFieldValue])
    }

    // Replace a value of the existing field if "set" called
    if (!append) {
      return void this.#content.set(name, [value as FormDataFieldValue])
    }

    // Append a new value to the existing field
    values.push(value as FormDataFieldValue)
  }

  /**
   * Returns computed length of the FormData content.
   *
   * @deprecated FormData#getComputedLength() method is non-standard and will be removed from this package in the next major release (4.x). Use https://npmjs.com/form-data-encoder package to serilize FormData.
   */
  @deprecateGetComputedLength
  getComputedLength(): number {
    return this.#encoder.getContentLength()
  }

  /**
   * Appends a new value onto an existing key inside a FormData object,
   * or adds the key if it does not already exist.
   *
   * @param name The name of the field whose data is contained in value
   * @param value The field value. You can pass any primitive type
   *   (including null and undefined), Buffer or Readable stream.
   *   Note that Arrays and Object will be converted to string
   *   by using String function.
   * @param filename A filename of given field.
   * @param options Additional field options.
   */
  append(name: string, value: unknown): void
  append(name: string, value: unknown, filename?: string): void
  append(
    name: string,
    value: unknown,
    options?: FormDataFieldOptions & {filename?: string}
  ): void
  append(
    name: string,
    value: unknown,
    filename?: string,
    options?: FormDataFieldOptions
  ): void
  @deprecateBuffer
  @deprecateReadStream
  append(
    name: string,
    value: unknown,
    filenameOrOptions?: string | FormDataFieldOptions,
    options?: FormDataFieldOptions
  ): void {
    return this.#setField({
      name,
      value,
      filenameOrOptions,
      options,
      append: true,
      argsLength: arguments.length
    })
  }

  /**
   * Set a new value for an existing key inside FormData,
   * or add the new field if it does not already exist.
   *
   * @param name The name of the field whose data is contained in value
   * @param value The field value. You can pass any primitive type
   *   (including null and undefined), Buffer or Readable stream.
   *   Note that Arrays and Object will be converted to string
   *   by using String function.
   * @param filename A filename of given field.
   * @param options Additional field options.
   *
   */
  set(name: string, value: unknown): void
  set(name: string, value: unknown, filename?: string): void
  set(
    name: string,
    value: unknown,
    options?: FormDataFieldOptions & {filename?: string}
  ): void
  set(
    name: string,
    value: unknown,
    filename?: string,
    options?: FormDataFieldOptions
  ): void
  @deprecateBuffer
  @deprecateReadStream
  set(
    name: string,
    value: unknown,
    filenameOrOptions?: string | FormDataFieldOptions,
    options?: FormDataFieldOptions
  ): void {
    return this.#setField({
      name,
      value,
      filenameOrOptions,
      options,
      append: false,
      argsLength: arguments.length
    })
  }

  /**
   * Returns the first value associated with the given name.
   * Buffer and Readable values will be returned as-is.
   *
   * @param {string} name A name of the value you want to retrieve.
   */
  get(name: string): FormDataFieldValue | null {
    const field = this.#content.get(String(name))

    if (!field) {
      return null
    }

    return field[0]
  }

  /**
   * Returns all the values associated with
   * a given key from within a FormData object.
   *
   * @param {string} name A name of the value you want to retrieve.
   */
  getAll(name: string): FormDataFieldValue[] {
    const field = this.#content.get(String(name))

    if (!field) {
      return []
    }

    return [...field]
  }

  /**
   * Check if a field with the given name exists inside FormData.
   *
   * @param name A name of the field you want to test for.
   *
   * @return
   */
  has(name: string): boolean {
    return this.#content.has(String(name))
  }

  /**
   * Deletes a key and its value(s) from a FormData object.
   *
   * @param name The name of the key you want to delete.
   */
  delete(name: string): void {
    return void this.#content.delete(String(name))
  }

  /**
   * Returns an [`iterator`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols) allowing to go through the **FormData** keys
   */
  * keys(): Generator<string> {
    for (const key of this.#content.keys()) {
      yield key
    }
  }

  /**
   * Returns an [`iterator`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols) allowing to go through the **FormData** key/value pairs
   */
  * entries(): Generator<[string, FormDataFieldValue]> {
    for (const name of this.keys()) {
      const values = this.getAll(name)

      // Yield each value of a field, like browser-side FormData does.
      for (const value of values) {
        yield [name, value]
      }
    }
  }

  /**
   * Returns an [`iterator`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols) allowing to go through the **FormData** values
   */
  * values(): Generator<FormDataFieldValue> {
    for (const [, value] of this) {
      yield value
    }
  }

  /**
   * An alias for FormData#entries()
   */
  [Symbol.iterator]() {
    return this.entries()
  }

  /**
   * Executes given callback function for each field of the FormData instance
   */
  forEach(
    fn: (value: FormDataFieldValue, key: string, fd: FormData) => void,

    ctx?: unknown
  ): void {
    for (const [name, value] of this) {
      fn.call(ctx, value, name, this)
    }
  }

  get [Symbol.toStringTag](): string {
    return "FormData"
  }

  [inspect.custom](): string {
    return this[Symbol.toStringTag]
  }

  /**
   * Returns an async iterator allowing to read form-data body using **for-await-of** syntax.
   * Read the [`async iteration proposal`](https://github.com/tc39/proposal-async-iteration) to get more info about async iterators.
   *
   * @deprecated FormData#[Symbol.asyncIterator]() method is non-standard and will be removed from this package in the next major release (4.x). Use https://npmjs.com/form-data-encoder package to serilize FormData.
   */
  @deprecateSymbolAsyncIterator
  async* [Symbol.asyncIterator](): AsyncGenerator<Uint8Array, void, undefined> {
    yield* this.#encoder.encode()
  }
}
