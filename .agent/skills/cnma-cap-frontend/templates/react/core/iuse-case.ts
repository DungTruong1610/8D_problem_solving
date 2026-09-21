/**
 * IUseCase — The interface all UseCases must implement.
 *
 * CONVENTION:
 * - Place in src/core/
 * - Every UseCase class implements this interface
 * - Input/Output are generic types specific to the use case
 * - Always return Result<Output> for consistent error handling
 */
import { Result } from "./Result";

export interface IUseCase<Input, Output> {
    execute(input: Input): Promise<Result<Output>>;
}
