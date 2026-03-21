package com.codebuddy.plugin.api

import com.codebuddy.plugin.settings.CodeBuddySettings
import com.google.gson.Gson
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException
import java.util.concurrent.TimeUnit

data class ChatResponse(
    val reply: String,
    val model: String? = null,
    val error: String? = null
)

data class HealthStatus(
    val connected: Boolean,
    val version: String? = null,
    val model: String? = null
)

class CodeBuddyClient {

    private val gson = Gson()
    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()

    private val client = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(120, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .build()

    private val serverUrl: String
        get() = CodeBuddySettings.getInstance().serverUrl.trimEnd('/')

    private val apiKey: String
        get() = CodeBuddySettings.getInstance().apiKey

    fun chat(message: String, context: String? = null): ChatResponse {
        val body = JsonObject().apply {
            addProperty("message", message)
            if (context != null) {
                addProperty("context", context)
            }
            val model = CodeBuddySettings.getInstance().model
            if (model.isNotBlank()) {
                addProperty("model", model)
            }
        }

        val requestBuilder = Request.Builder()
            .url("$serverUrl/api/chat")
            .post(gson.toJson(body).toRequestBody(jsonMediaType))
            .header("Content-Type", "application/json")

        if (apiKey.isNotBlank()) {
            requestBuilder.header("Authorization", "Bearer $apiKey")
        }

        return try {
            val response = client.newCall(requestBuilder.build()).execute()
            val responseBody = response.body?.string() ?: ""

            if (!response.isSuccessful) {
                ChatResponse(
                    reply = "",
                    error = "Server returned ${response.code}: $responseBody"
                )
            } else {
                val json = JsonParser.parseString(responseBody).asJsonObject
                ChatResponse(
                    reply = json.get("response")?.asString
                        ?: json.get("reply")?.asString
                        ?: json.get("message")?.asString
                        ?: responseBody,
                    model = json.get("model")?.asString
                )
            }
        } catch (e: IOException) {
            ChatResponse(reply = "", error = "Connection failed: ${e.message}")
        } catch (e: Exception) {
            ChatResponse(reply = "", error = "Unexpected error: ${e.message}")
        }
    }

    fun healthCheck(): HealthStatus {
        val requestBuilder = Request.Builder()
            .url("$serverUrl/api/health")
            .get()

        if (apiKey.isNotBlank()) {
            requestBuilder.header("Authorization", "Bearer $apiKey")
        }

        return try {
            val response = client.newCall(requestBuilder.build()).execute()
            val responseBody = response.body?.string() ?: ""

            if (!response.isSuccessful) {
                HealthStatus(connected = false)
            } else {
                val json = JsonParser.parseString(responseBody).asJsonObject
                HealthStatus(
                    connected = true,
                    version = json.get("version")?.asString,
                    model = json.get("model")?.asString
                )
            }
        } catch (_: Exception) {
            HealthStatus(connected = false)
        }
    }

    companion object {
        private var instance: CodeBuddyClient? = null

        fun getInstance(): CodeBuddyClient {
            if (instance == null) {
                instance = CodeBuddyClient()
            }
            return instance!!
        }
    }
}
