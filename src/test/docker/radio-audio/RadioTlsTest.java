package kr.nm.hls;

import com.sun.net.httpserver.HttpsServer;
import com.sun.net.httpserver.HttpsConfigurator;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.KeyStore;
import javax.net.ssl.KeyManagerFactory;
import javax.net.ssl.SSLContext;
import javax.net.ssl.SSLException;
import javax.net.ssl.SSLSocket;
import javax.net.ssl.TrustManagerFactory;
import org.apache.http.protocol.BasicHttpContext;

public final class RadioTlsTest {
  public static void main(String[] args) throws Exception {
    KeyStore keys = KeyStore.getInstance("PKCS12");
    try (var input = Files.newInputStream(Path.of(args[0]))) {
      keys.load(input, "test-only".toCharArray());
    }
    KeyManagerFactory keyManager = KeyManagerFactory.getInstance(KeyManagerFactory.getDefaultAlgorithm());
    keyManager.init(keys, "test-only".toCharArray());
    TrustManagerFactory trust = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm());
    trust.init(keys);
    SSLContext context = SSLContext.getInstance("TLS");
    context.init(keyManager.getKeyManagers(), trust.getTrustManagers(), null);
    HttpsServer server = HttpsServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
    server.setHttpsConfigurator(new HttpsConfigurator(context));
    server.start();
    try {
      RadioSslSocketFactory factory = new RadioSslSocketFactory(context);
      int port = server.getAddress().getPort();
      for (String host : new String[]{"live.andongmbc.co.kr", "ordinary.invalid"}) {
        try (Socket raw = new Socket("127.0.0.1", port);
             SSLSocket socket = (SSLSocket) factory.createLayeredSocket(raw, host, port, new BasicHttpContext())) {
          String expected = host.startsWith("live.") ? "TLSv1.2" : "TLSv1.3";
          if (!expected.equals(socket.getSession().getProtocol())) {
            throw new AssertionError(host + " negotiated " + socket.getSession().getProtocol() + ", expected " + expected);
          }
          System.out.println(host + " negotiated " + expected);
        }
      }
      try (Socket raw = new Socket("127.0.0.1", port)) {
        try (Socket ignored = factory.createLayeredSocket(raw, "wrong.invalid", port, new BasicHttpContext())) {
          throw new AssertionError("Hostname mismatch was accepted");
        } catch (SSLException expected) {
          System.out.println("Hostname mismatch rejected");
        }
      }
      try (Socket raw = new Socket("127.0.0.1", port)) {
        try (Socket ignored = RadioSslSocketFactory.create().createLayeredSocket(raw, "live.andongmbc.co.kr", port, new BasicHttpContext())) {
          throw new AssertionError("Untrusted certificate was accepted");
        } catch (SSLException expected) {
          System.out.println("Untrusted certificate rejected");
        }
      }
    } finally {
      server.stop(0);
    }
  }
}
