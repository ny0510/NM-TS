package kr.nm.hls;

import com.sedmelluq.discord.lavaplayer.container.MediaContainerRegistry;
import com.sedmelluq.discord.lavaplayer.player.AudioPlayerManager;
import com.sedmelluq.discord.lavaplayer.source.http.HttpAudioSourceManager;
import com.sedmelluq.discord.lavaplayer.tools.io.HttpClientTools;
import com.sedmelluq.discord.lavaplayer.tools.io.HttpInterfaceManager;
import com.sedmelluq.discord.lavaplayer.tools.io.ThreadLocalHttpInterfaceManager;
import com.sedmelluq.discord.lavaplayer.tools.http.ExtendedHttpClientBuilder;
import dev.arbjerg.lavalink.api.AudioPlayerManagerConfiguration;
import java.io.IOException;
import lavalink.server.config.HttpConfig;
import lavalink.server.config.ServerConfig;
import org.apache.http.HttpHost;
import org.apache.http.auth.AuthScope;
import org.apache.http.auth.UsernamePasswordCredentials;
import org.apache.http.client.protocol.HttpClientContext;
import org.apache.http.impl.client.BasicCredentialsProvider;
import org.apache.http.impl.client.DefaultClientConnectionReuseStrategy;
import org.apache.http.impl.client.HttpClientBuilder;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.DisposableBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(prefix = "lavalink.server.sources", name = "http", havingValue = "true")
public final class RadioAudioConfiguration implements AudioPlayerManagerConfiguration, DisposableBean {
  private final ServerConfig config;
  private HttpInterfaceManager hlsHttp;

  public RadioAudioConfiguration(ServerConfig config) {
    this.config = config;
  }

  @Override
  public AudioPlayerManager configure(AudioPlayerManager manager) {
    // Construct clients after Lavalink applies lavalink.server.timeouts.
    hlsHttp = new ThreadLocalHttpInterfaceManager(
        HttpClientTools.createSharedCookiesHttpBuilder().setRedirectStrategy(new HttpClientTools.NoRedirectsStrategy()),
        HttpClientTools.DEFAULT_REQUEST_CONFIG);
    hlsHttp.configureBuilder(this::configureHttp);
    AdaptiveM3uProbe probe = new AdaptiveM3uProbe(hlsHttp);
    MediaContainerRegistry registry = new MediaContainerRegistry(MediaContainerRegistry.DEFAULT_REGISTRY.getAll().stream()
        .map(existing -> "m3u".equals(existing.getName()) ? probe : existing).toList());
    HttpAudioSourceManager source = new HttpAudioSourceManager(registry);
    source.configureBuilder(this::configureHttp);
    // Native/plugin music sources are registered first; Lavalink adds its fallback HTTP source last.
    manager.registerSourceManager(source);
    LoggerFactory.getLogger(RadioAudioConfiguration.class).info(
        "HLS AAC/MPEG-TS enabled (connect={}ms, pool={}ms, read={}ms)",
        HttpClientTools.DEFAULT_REQUEST_CONFIG.getConnectTimeout(),
        HttpClientTools.DEFAULT_REQUEST_CONFIG.getConnectionRequestTimeout(),
        HttpClientTools.DEFAULT_REQUEST_CONFIG.getSocketTimeout());
    return manager;
  }

  private void configureHttp(HttpClientBuilder builder) {
    ((ExtendedHttpClientBuilder) builder).setSslConnectionSocketFactory(RadioSslSocketFactory.create());
    builder.setConnectionReuseStrategy((response, context) -> {
      HttpHost host = HttpClientContext.adapt(context).getTargetHost();
      return (host == null || !("ebsonair.ebs.co.kr".equalsIgnoreCase(host.getHostName())
          || "live.andongmbc.co.kr".equalsIgnoreCase(host.getHostName())
          || "onairsfm.jejumbc.com".equalsIgnoreCase(host.getHostName())))
          && DefaultClientConnectionReuseStrategy.INSTANCE.keepAlive(response, context);
    });
    HttpConfig proxy = config.getHttpConfig();
    if (proxy == null || proxy.getProxyHost().isBlank()) {
      return;
    }
    builder.setProxy(new HttpHost(proxy.getProxyHost(), proxy.getProxyPort()));
    if (!proxy.getProxyUser().isBlank()) {
      BasicCredentialsProvider credentials = new BasicCredentialsProvider();
      credentials.setCredentials(new AuthScope(proxy.getProxyHost(), proxy.getProxyPort()),
          new UsernamePasswordCredentials(proxy.getProxyUser(), proxy.getProxyPassword()));
      builder.setDefaultCredentialsProvider(credentials);
    }
  }

  @Override
  public void destroy() throws IOException {
    if (hlsHttp != null) {
      hlsHttp.close();
    }
  }
}
