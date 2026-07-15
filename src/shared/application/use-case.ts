import type { DomainError, Result } from "../domain/result.js";

/**
 * One actor intent, one entry point. A contract, deliberately not a base
 * class: plumbing is composed in through ports, never inherited.
 */
export interface UseCase<In, Out> {
  execute(input: In): Result<Out, DomainError>;
}

/** Same contract for use cases that must await infrastructure (crypto, keychain). */
export interface AsyncUseCase<In, Out> {
  execute(input: In): Promise<Result<Out, DomainError>>;
}
