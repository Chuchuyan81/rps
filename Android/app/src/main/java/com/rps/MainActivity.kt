package com.rps

import android.annotation.SuppressLint
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.ViewGroup
import android.webkit.RenderProcessGoneDetail
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.browser.customtabs.CustomTabColorSchemeParams
import androidx.browser.customtabs.CustomTabsIntent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView

private const val PWA_URL = "https://rps-arena-game.netlify.app/"

class MainActivity : ComponentActivity() {
    private var webView: WebView? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView?.canGoBack() == true) {
                    webView?.goBack()
                } else {
                    isEnabled = false
                    onBackPressedDispatcher.onBackPressed()
                }
            }
        })

        setContent {
            MaterialTheme {
                var useFallback by remember { mutableStateOf(false) }
                if (useFallback) {
                    webView = null
                    WebViewFallbackScreen(activity = this@MainActivity, url = PWA_URL)
                } else {
                    WebViewScreen(
                        url = PWA_URL,
                        onWebViewCreated = { webView = it },
                        onNeedFallback = {
                            webView = null
                            useFallback = true
                        },
                    )
                }
            }
        }
    }
}

private fun openUrlExternal(activity: ComponentActivity, url: String) {
    val uri = Uri.parse(url)
    try {
        val intent = CustomTabsIntent.Builder()
            .setDefaultColorSchemeParams(
                CustomTabColorSchemeParams.Builder().build(),
            )
            .build()
        intent.launchUrl(activity, uri)
    } catch (_: Exception) {
        activity.startActivity(
            android.content.Intent(android.content.Intent.ACTION_VIEW, uri),
        )
    }
}

@Composable
private fun WebViewFallbackScreen(activity: ComponentActivity, url: String) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            text = stringResource(R.string.webview_fallback_title),
            style = MaterialTheme.typography.headlineSmall,
        )
        Text(
            text = stringResource(R.string.webview_fallback_message),
            modifier = Modifier.padding(top = 16.dp),
            style = MaterialTheme.typography.bodyMedium,
        )
        Button(
            onClick = { openUrlExternal(activity, url) },
            modifier = Modifier.padding(top = 24.dp),
        ) {
            Text(stringResource(R.string.open_in_browser))
        }
    }
}

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun WebViewScreen(
    url: String,
    onWebViewCreated: (WebView) -> Unit,
    onNeedFallback: () -> Unit,
) {
    val mainHandler = remember { Handler(Looper.getMainLooper()) }
    AndroidView(
        modifier = Modifier.fillMaxSize(),
        factory = { context ->
            try {
                WebView(context).apply {
                    layoutParams = ViewGroup.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.MATCH_PARENT,
                    )
                    webChromeClient = WebChromeClient()
                    webViewClient = object : WebViewClient() {
                        override fun onRenderProcessGone(
                            view: WebView,
                            detail: RenderProcessGoneDetail,
                        ): Boolean {
                            mainHandler.post { onNeedFallback() }
                            return true
                        }
                    }
                    settings.apply {
                        javaScriptEnabled = true
                        domStorageEnabled = true
                        loadWithOverviewMode = true
                        useWideViewPort = true
                        cacheMode = WebSettings.LOAD_DEFAULT
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                            mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
                        }
                        userAgentString = userAgentString.replace("; wv", "")
                    }
                    loadUrl(url)
                    onWebViewCreated(this)
                }
            } catch (_: Throwable) {
                mainHandler.post { onNeedFallback() }
                FrameLayout(context).apply {
                    layoutParams = ViewGroup.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.MATCH_PARENT,
                    )
                }
            }
        },
        update = { },
    )
}
