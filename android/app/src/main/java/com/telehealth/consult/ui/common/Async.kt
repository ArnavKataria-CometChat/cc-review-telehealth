package com.telehealth.consult.ui.common

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import com.telehealth.consult.data.ApiException

/** Minimal async result for one-shot loads. */
sealed interface Async<out T> {
    data object Loading : Async<Nothing>
    data class Success<T>(val data: T) : Async<T>
    data class Failure(val message: String) : Async<Nothing>
}

/** A load that can be re-triggered (after a mutation). */
class Reloadable(private val bump: () -> Unit) {
    fun reload() = bump()
}

/**
 * Runs [block] on first composition and whenever [keys] change or [Reloadable.reload]
 * is called, exposing the result as [Async]. Errors are surfaced as friendly text.
 */
@Composable
fun <T> rememberAsync(vararg keys: Any?, block: suspend () -> T): Pair<Async<T>, Reloadable> {
    var trigger by remember { mutableIntStateOf(0) }
    val reloadable = remember { Reloadable { trigger++ } }
    val state by produceState<Async<T>>(Async.Loading, keys = arrayOf(trigger, *keys)) {
        value = Async.Loading
        value = try {
            Async.Success(block())
        } catch (e: ApiException) {
            Async.Failure(e.userMessage)
        } catch (e: Exception) {
            Async.Failure(e.message ?: "Something went wrong")
        }
    }
    return state to reloadable
}

/** Tracks an in-flight one-shot action (submit/mutation) with error capture. */
class ActionState {
    var running by mutableStateOf(false)
        internal set
    var error by mutableStateOf<String?>(null)
        internal set
}

suspend fun ActionState.run(block: suspend () -> Unit): Boolean {
    running = true
    error = null
    return try {
        block()
        true
    } catch (e: ApiException) {
        error = e.userMessage
        false
    } catch (e: Exception) {
        error = e.message ?: "Something went wrong"
        false
    } finally {
        running = false
    }
}

@Composable
fun rememberActionState(): ActionState = remember { ActionState() }
