export const timeout = (ms: number, errorText = "Timeout") => {
    return new Promise((_, reject) => {
        setTimeout(() => reject(new Error(errorText)), ms);
    });
}