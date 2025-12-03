use api::LayerConfig;
use axum::Extension;
use clap::Parser;
use std::net::SocketAddr;
use std::process::exit;
use std::sync::Arc;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Load the variable from `.env` into the environment.
    dotenv::dotenv().ok();

    // Set the RUST_LOG, if it hasn't been explicitly defined
    if std::env::var_os("RUST_LOG").is_none() {
        // This is safe to call in single-threaded programs, which we still are at this point.
        unsafe { std::env::set_var("RUST_LOG", "api=debug,tower_http=debug") }
    }
    tracing_subscriber::fmt::init();

    // Panic if we can't parse configuration
    let config = api::Config::parse();

    // Initialize JSON Web Key Set (JWKS)
    config.auth.initialize().await?;

    // Read the layer config file
    let layers_file_path = std::path::Path::new(&config.layers_file);
    let layers = LayerConfig::parse(layers_file_path).unwrap_or_else(|err| {
        tracing::error!("{err}");
        exit(1)
    });

    tracing::info!(
        "Found {layers} layers in {groups} root groups.",
        groups = layers.groups.len(),
        layers = layers.layers.len()
    );

    if config.should_only_validate {
        tracing::info!("Validation successful, exiting.");
        return Ok(());
    }

    let client_config = api::ClientConfig::parse();

    // Set up a database connection pool & run any pending migrations
    let pool = config.database.setup().await;

    // Build our application
    let app = api::app(pool).await;
    let app = app
        .layer(Extension(Arc::new(layers)))
        .layer(Extension(Arc::new(client_config)));

    // run our app with hyper
    let address = SocketAddr::from(([0, 0, 0, 0], config.app_port));
    tracing::debug!("listening on {}", address);
    let listener = tokio::net::TcpListener::bind(address).await.unwrap();
    axum::serve(listener, app.into_make_service())
        .await
        .unwrap();

    Ok(())
}
