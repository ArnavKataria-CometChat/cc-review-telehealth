package com.telehealth.consult.data

import com.telehealth.consult.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.KSerializer
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.logging.HttpLoggingInterceptor
import java.io.IOException
import java.util.concurrent.TimeUnit

/**
 * Thin OkHttp + kotlinx.serialization transport for the telehealth REST API.
 *
 * Responsibilities: attach the Bearer session token, encode/decode JSON, and
 * normalise every failure into an [ApiException] (mapping the backend's
 * `{ error: { code, message } }` envelope). An unauthorized (401) response
 * clears the session via [onUnauthorized] so the UI falls back to login.
 */
class ApiClient(
    private val session: SessionStore,
    baseUrl: String = BuildConfig.API_BASE_URL,
    private val onUnauthorized: () -> Unit = {},
) {
    // Normalise to a trailing slash so relative paths resolve predictably.
    private val baseUrl = if (baseUrl.endsWith("/")) baseUrl else "$baseUrl/"

    private val http: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .addInterceptor(
            HttpLoggingInterceptor().apply {
                level = if (BuildConfig.DEBUG) HttpLoggingInterceptor.Level.BASIC
                else HttpLoggingInterceptor.Level.NONE
            },
        )
        .build()

    suspend fun <R> get(path: String, response: KSerializer<R>, query: Map<String, String?> = emptyMap()): R =
        execute(request(path, query).get().build(), response)

    suspend fun <B, R> post(path: String, body: B, bodySer: KSerializer<B>, response: KSerializer<R>): R =
        execute(request(path).post(jsonBody(body, bodySer)).build(), response)

    suspend fun <B, R> patch(path: String, body: B, bodySer: KSerializer<B>, response: KSerializer<R>): R =
        execute(request(path).patch(jsonBody(body, bodySer)).build(), response)

    suspend fun delete(path: String) {
        executeUnit(request(path).delete().build())
    }

    // --- internals ---------------------------------------------------------

    private fun request(path: String, query: Map<String, String?> = emptyMap()): Request.Builder {
        val urlBuilder = (baseUrl + path.trimStart('/')).toHttpUrl().newBuilder()
        for ((k, v) in query) if (!v.isNullOrBlank()) urlBuilder.addQueryParameter(k, v)
        return Request.Builder()
            .url(urlBuilder.build())
            .apply { session.currentToken?.let { header("Authorization", "Bearer $it") } }
    }

    private fun <B> jsonBody(body: B, ser: KSerializer<B>): RequestBody =
        Json.encodeToString(ser, body).toRequestBody(JSON_MEDIA)

    private suspend fun <R> execute(request: Request, response: KSerializer<R>): R =
        withContext(Dispatchers.IO) {
            val raw = call(request)
            runCatching { Json.decodeFromString(response, raw) }
                .getOrElse {
                    throw ApiException(0, "decode_error", "Unexpected response from server.")
                }
        }

    private suspend fun executeUnit(request: Request) =
        withContext(Dispatchers.IO) { call(request); Unit }

    private fun call(request: Request): String {
        val res = try {
            http.newCall(request).execute()
        } catch (io: IOException) {
            throw ApiException.network(io)
        }
        res.use {
            val body = it.body?.string().orEmpty()
            if (it.isSuccessful) return body
            if (it.code == 401) onUnauthorized()
            throw parseError(it.code, body)
        }
    }

    private fun parseError(status: Int, body: String): ApiException {
        val parsed = runCatching {
            Json.decodeFromString(
                com.telehealth.consult.data.model.ApiErrorBody.serializer(),
                body,
            ).error
        }.getOrNull()
        val message = parsed?.let {
            val detail = it.details?.joinToString("; ") { d -> "${d.path}: ${d.message}" }
            if (detail.isNullOrBlank()) it.message else "${it.message} ($detail)"
        } ?: "Request failed (HTTP $status)"
        return ApiException(status, parsed?.code ?: "error", message)
    }

    private companion object {
        val JSON_MEDIA = "application/json; charset=utf-8".toMediaType()
    }
}
