/**
 * Result<T> — A monad for consistent success/failure handling.
 *
 * CONVENTION:
 * - Place in src/core/
 * - All UseCases return Result<T> instead of throwing errors
 * - Callers check result.isSuccess before accessing result.value
 * - Errors are always wrapped in Result.fail() with a message
 *
 * USAGE:
 *   const result = await myUseCase.execute(input);
 *   if (result.isSuccess) {
 *       console.log(result.value);
 *   } else {
 *       console.error(result.error);
 *   }
 */
export class Result<T> {
    public readonly isSuccess: boolean;
    public readonly isFailure: boolean;
    public readonly error: string | null;
    private readonly _value: T | null;

    private constructor(isSuccess: boolean, error: string | null, value: T | null) {
        this.isSuccess = isSuccess;
        this.isFailure = !isSuccess;
        this.error = error;
        this._value = value;
    }

    /**
     * Access the success value. Throws if result is a failure.
     */
    get value(): T {
        if (this.isFailure) {
            throw new Error("Cannot get value of a failed result. Check isSuccess first.");
        }
        return this._value as T;
    }

    /**
     * Create a success result.
     */
    static ok<U>(value: U): Result<U> {
        return new Result<U>(true, null, value);
    }

    /**
     * Create a failure result.
     */
    static fail<U>(error: string): Result<U> {
        return new Result<U>(false, error, null);
    }
}
