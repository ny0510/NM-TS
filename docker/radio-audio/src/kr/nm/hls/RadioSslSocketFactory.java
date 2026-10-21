package kr.nm.hls;

import com.sedmelluq.discord.lavaplayer.tools.io.TrustManagerBuilder;
import java.io.IOException;
import java.net.Socket;
import javax.net.ssl.SSLContext;
import javax.net.ssl.X509TrustManager;
import org.apache.http.conn.ssl.SSLConnectionSocketFactory;
import org.apache.http.protocol.HttpContext;

final class RadioSslSocketFactory extends SSLConnectionSocketFactory {
  private final SSLConnectionSocketFactory andong;

  RadioSslSocketFactory(SSLContext context) {
    super(context, getDefaultHostnameVerifier());
    andong = new SSLConnectionSocketFactory(context, new String[]{"TLSv1.2"}, null, getDefaultHostnameVerifier());
  }

  static RadioSslSocketFactory create() {
    try {
      X509TrustManager trust = new TrustManagerBuilder().addBuiltinCertificates().addFromResourceDirectory("/certificates").build();
      SSLContext context = SSLContext.getInstance("TLS");
      context.init(null, new X509TrustManager[]{trust}, null);
      return new RadioSslSocketFactory(context);
    } catch (Exception exception) {
      throw new IllegalStateException("Unable to configure radio TLS certificate validation", exception);
    }
  }

  @Override
  public Socket createLayeredSocket(Socket socket, String target, int port, HttpContext context) throws IOException {
    if ("live.andongmbc.co.kr".equalsIgnoreCase(target)) {
      return andong.createLayeredSocket(socket, target, port, context);
    }
    return super.createLayeredSocket(socket, target, port, context);
  }
}
