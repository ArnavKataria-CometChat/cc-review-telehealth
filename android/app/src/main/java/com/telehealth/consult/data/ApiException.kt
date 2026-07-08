package com.telehealth.consult.data

/**
 * Thrown for any non-2xx API response (or transport failure). [status] is the
 * HTTP code (0 for network errors); [code] mirrors the backend error envelope's
 * machine code (e.g. "forbidden", "conflict"). [userMessage] is safe to show.
 */
class ApiException(
    val status: Int,
    val code: String,
    val userMessage: String,
) : Exception(userMessage) {

    val isUnauthorized: Boolean get() = status == 401

    companion object {
        fun network(cause: Throwable): ApiException =
            ApiException(
                status = 0,
                code = "network_error",
                userMessage = "Can't reach the server. Is the backend running? " +
                    "(${cause.message ?: cause.javaClass.simpleName})",
            )
    }
}
