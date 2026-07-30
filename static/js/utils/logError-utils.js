
/**
 * Logs error details and performance telemetry to the DB in the backend
 * 
 * @param {string} action The operation being executed when the error occurred
 * @param {*} info Contextual data, error messages, or stack traces
 * @param {number|null} [durationMs=null] Execution time in milliseconds (performance only)
 * @param {string|number|null} [errorCode=null] Specific error identifier or status code (see https://docs.crestr.co.uk/technical/action_log_codes/)
 */
export function logError(action, info, durationMs = null, errorCode = null) {

    try { 
        fetch(window.appConfig.apiLogErrorUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                action: action,
                outcome: false,
                info: info,
                duration_ms: durationMs,
                error_code: errorCode
            }),
        })
    }
    catch(error) {
        console.log("ERROR WHILST ATTEMPTING TO LOG ERROR : ", error)
    }
}