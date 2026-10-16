package `in`.quickartphotography.app

import `in`.quickartphotography.app.R

import android.annotation.SuppressLint
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.content.pm.ActivityInfo
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.media.MediaScannerConnection
import android.util.Base64
import android.webkit.JavascriptInterface
import java.io.File
import java.io.FileOutputStream
import android.provider.MediaStore
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.webkit.CookieManager
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var swipeRefresh: SwipeRefreshLayout
    private lateinit var customViewContainer: FrameLayout
    private lateinit var errorView: LinearLayout
    private lateinit var btnRetry: Button

    private val appUrl = "https://quickartphotography.in/app/"

    private var fileUploadCallback: ValueCallback<Array<Uri>>? = null
    private var customVideoView: View? = null
    private var customViewCallback: WebChromeClient.CustomViewCallback? = null

    private val filePickerLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (fileUploadCallback == null) return@registerForActivityResult
        val results = if (result.resultCode == RESULT_OK) {
            val data = result.data
            if (data?.clipData != null) {
                val count = data.clipData!!.itemCount
                Array(count) { i -> data.clipData!!.getItemAt(i).uri }
            } else if (data?.data != null) {
                arrayOf(data.data!!)
            } else {
                null
            }
        } else {
            null
        }
        fileUploadCallback?.onReceiveValue(results)
        fileUploadCallback = null
    }

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { _ ->
        // Permissions handled
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        webView = findViewById(R.id.webView)
        swipeRefresh = findViewById(R.id.swipeRefresh)
        customViewContainer = findViewById(R.id.customViewContainer)
        errorView = findViewById(R.id.errorView)
        btnRetry = findViewById(R.id.btnRetry)

        setupWindow()
        checkAndRequestPermissions()
        setupWebView()
        setupSwipeRefresh()
        setupRetryButton()
        setupBackNavigation()

        loadApp()
    }

    private fun setupWindow() {
        window.statusBarColor = ContextCompat.getColor(this, R.color.primary_dark)
        window.navigationBarColor = ContextCompat.getColor(this, R.color.primary_dark)
    }

    private fun checkAndRequestPermissions() {
        val permissions = mutableListOf<String>()
        if (ContextCompat.checkSelfPermission(this, android.Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            permissions.add(android.Manifest.permission.CAMERA)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, android.Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                permissions.add(android.Manifest.permission.POST_NOTIFICATIONS)
            }
        }
        if (permissions.isNotEmpty()) {
            permissionLauncher.launch(permissions.toTypedArray())
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        val settings = webView.settings

        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.cacheMode = WebSettings.LOAD_DEFAULT
        settings.allowFileAccess = true
        settings.allowContentAccess = true
        settings.loadWithOverviewMode = true
        settings.useWideViewPort = true
        settings.builtInZoomControls = false
        settings.displayZoomControls = false
        settings.mediaPlaybackRequiresUserGesture = false

        webView.isVerticalScrollBarEnabled = true
        webView.isHorizontalScrollBarEnabled = false
        webView.overScrollMode = View.OVER_SCROLL_NEVER

        val defaultUa = settings.userAgentString
        settings.userAgentString = "$defaultUa QuickArtAcademyApp/2.4 (Android)"

        val cookieManager = CookieManager.getInstance()
        cookieManager.setAcceptCookie(true)
        cookieManager.setAcceptThirdPartyCookies(webView, true)

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val url = request?.url?.toString() ?: return false

                if (url.startsWith("https://wa.me/") || url.startsWith("whatsapp://") || url.startsWith("tel:") || url.startsWith("mailto:") || url.startsWith("upi:")) {
                    try {
                        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                        startActivity(intent)
                        return true
                    } catch (e: Exception) {
                        Toast.makeText(this@MainActivity, "Action open nahi ho paayi", Toast.LENGTH_SHORT).show()
                        return true
                    }
                }

                if (url.contains("quickartphotography.in")) {
                    return false
                }

                try {
                    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                    startActivity(intent)
                    return true
                } catch (_: Exception) {
                    return false
                }
            }

            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                super.onPageStarted(view, url, favicon)
                hideErrorView()
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                swipeRefresh.isRefreshing = false
                cookieManager.flush()
            }
        }

        // Lets the web app save generated images (e.g. course certificates) to the Gallery.
        webView.addJavascriptInterface(ImageSaveBridge(), "QAAndroid")

        webView.webChromeClient = object : WebChromeClient() {
            override fun onShowCustomView(view: View?, callback: CustomViewCallback?) {
                if (customVideoView != null) {
                    onHideCustomView()
                    return
                }

                customVideoView = view
                customViewCallback = callback

                customViewContainer.addView(
                    view,
                    FrameLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.MATCH_PARENT
                    )
                )
                customViewContainer.visibility = View.VISIBLE
                swipeRefresh.visibility = View.GONE

                requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE
                window.addFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN)
            }

            override fun onHideCustomView() {
                if (customVideoView == null) return

                customViewContainer.visibility = View.GONE
                customViewContainer.removeView(customVideoView)
                customVideoView = null
                customViewCallback?.onCustomViewHidden()

                swipeRefresh.visibility = View.VISIBLE
                requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
                window.clearFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN)
            }

            override fun onShowFileChooser(
                wView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?
            ): Boolean {
                fileUploadCallback?.onReceiveValue(null)
                fileUploadCallback = filePathCallback

                val takePictureIntent = Intent(MediaStore.ACTION_IMAGE_CAPTURE)
                val contentSelectionIntent = Intent(Intent.ACTION_GET_CONTENT).apply {
                    addCategory(Intent.CATEGORY_OPENABLE)
                    type = "*/*"
                    putExtra(Intent.EXTRA_MIME_TYPES, arrayOf("image/*", "video/*", "application/pdf", "application/zip"))
                }

                val chooserIntent = Intent(Intent.ACTION_CHOOSER).apply {
                    putExtra(Intent.EXTRA_INTENT, contentSelectionIntent)
                    putExtra(Intent.EXTRA_TITLE, "Select Photo or Document")
                    putExtra(Intent.EXTRA_INITIAL_INTENTS, arrayOf(takePictureIntent))
                }

                filePickerLauncher.launch(chooserIntent)
                return true
            }
        }
    }

    private var backPressedTime: Long = 0

    private fun setupSwipeRefresh() {
        swipeRefresh.isEnabled = false // Disable touch interception to allow 100% smooth WebView scrolling
    }

    private fun setupRetryButton() {
        btnRetry.setOnClickListener {
            loadApp()
        }
    }

    private fun setupBackNavigation() {
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (customVideoView != null) {
                    webView.webChromeClient?.onHideCustomView()
                    return
                }

                // Check if web app JavaScript has a back handler (classroom player, sheet, tab, etc.)
                webView.evaluateJavascript("typeof window.handleNativeAppBack === 'function' ? window.handleNativeAppBack() : false") { result ->
                    val handled = result != null && (result == "true" || result.trim('"') == "true")
                    if (!handled) {
                        runOnUiThread {
                            if (webView.canGoBack()) {
                                webView.goBack()
                            } else {
                                if (backPressedTime + 2000 > System.currentTimeMillis()) {
                                    finish()
                                } else {
                                    Toast.makeText(this@MainActivity, "Press back again to exit", Toast.LENGTH_SHORT).show()
                                    backPressedTime = System.currentTimeMillis()
                                }
                            }
                        }
                    }
                }
            }
        })
    }

    private fun loadApp() {
        if (isNetworkAvailable()) {
            hideErrorView()
            webView.loadUrl(appUrl)
        } else {
            showErrorView()
        }
    }

    private fun showErrorView() {
        errorView.visibility = View.VISIBLE
        swipeRefresh.visibility = View.GONE
    }

    private fun hideErrorView() {
        errorView.visibility = View.GONE
        swipeRefresh.visibility = View.VISIBLE
    }

    private fun isNetworkAvailable(): Boolean {
        val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val network = cm.activeNetwork ?: return false
        val capabilities = cm.getNetworkCapabilities(network) ?: return false
        return capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }

    override fun onResume() {
        super.onResume()
        webView.onResume()
        CookieManager.getInstance().flush()
    }

    override fun onPause() {
        super.onPause()
        webView.onPause()
        CookieManager.getInstance().flush()
    }

    override fun onDestroy() {
        webView.destroy()
        super.onDestroy()
    }

    inner class ImageSaveBridge {
        @JavascriptInterface
        fun saveImage(dataUrl: String, fileName: String): String {
            return try {
                val base64 = dataUrl.substringAfter("base64,", dataUrl)
                val bytes = Base64.decode(base64, Base64.DEFAULT)
                val safeName = fileName.replace(Regex("[^A-Za-z0-9._-]"), "_").ifBlank { "QuickArt_Certificate.png" }

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    val values = ContentValues().apply {
                        put(MediaStore.Images.Media.DISPLAY_NAME, safeName)
                        put(MediaStore.Images.Media.MIME_TYPE, "image/png")
                        put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/QuickArt")
                    }
                    val uri = contentResolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values)
                        ?: return "error"
                    contentResolver.openOutputStream(uri)?.use { it.write(bytes) } ?: return "error"
                } else {
                    if (ContextCompat.checkSelfPermission(this@MainActivity, android.Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
                        runOnUiThread { permissionLauncher.launch(arrayOf(android.Manifest.permission.WRITE_EXTERNAL_STORAGE)) }
                        return "permission"
                    }
                    val dir = File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES), "QuickArt")
                    if (!dir.exists()) dir.mkdirs()
                    val file = File(dir, safeName)
                    FileOutputStream(file).use { it.write(bytes) }
                    MediaScannerConnection.scanFile(this@MainActivity, arrayOf(file.absolutePath), arrayOf("image/png"), null)
                }
                runOnUiThread {
                    Toast.makeText(this@MainActivity, "Certificate Gallery me save ho gaya (Pictures/QuickArt)", Toast.LENGTH_LONG).show()
                }
                "ok"
            } catch (e: Exception) {
                "error"
            }
        }
    }
}
