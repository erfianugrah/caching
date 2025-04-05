/**
 * Base command interface for the Command pattern
 * T represents the return type of the command
 */
export interface Command<T> {
  /**
   * Execute the command
   * @returns Promise with the result of command execution
   */
  execute(): Promise<T>;
}

/**
 * Base abstract command class with common functionality
 */
export abstract class BaseCommand<T> implements Command<T> {
  /**
   * Execute the command (to be implemented by subclasses)
   */
  abstract execute(): Promise<T>;
  
  /**
   * Validate input parameters before execution
   * @returns true if validation passes, otherwise throws an error
   */
  protected validate(): boolean {
    return true;
  }
}