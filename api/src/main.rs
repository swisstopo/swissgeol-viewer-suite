use clap::Parser;
use std::net::SocketAddr;
use std::process::exit;
use std::sync::Arc;
use anyhow::{anyhow};
use axum::Extension;
use api::{LayerConfigContext, LayerGroup, LayerGroupChild, ResolveLayer};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Load the variable from `.env` into the environment.
    dotenv::dotenv().ok();

    // Set the RUST_LOG, if it hasn't been explicitly defined
    if std::env::var_os("RUST_LOG").is_none() {
        // This is safe to call in single-threaded programs, which we still are at this point.
        unsafe {
            std::env::set_var("RUST_LOG", "api=debug,tower_http=debug")
        }
    }
    tracing_subscriber::fmt::init();

    // Panic if we can't parse configuration
    let config = api::Config::parse();

    // Set up a database connection pool & run any pending migrations
    let pool = config.database.setup().await;

    // Initialize JSON Web Key Set (JWKS)
    config.auth.initialize().await?;

    // Build our application
    let app = api::app(pool).await;

    // Read the layer config file
    let layers = read_layers(&config.layers_file).unwrap_or_else(|err| {
        tracing::error!("{err}");
        exit(1)
    });
    let app = app.layer(Extension(Arc::new(layers)));

    // run our app with hyper
    let address = SocketAddr::from(([0, 0, 0, 0], config.app_port));
    tracing::debug!("listening on {}", address);
    let listener = tokio::net::TcpListener::bind(address).await.unwrap();
    axum::serve(listener, app.into_make_service())
        .await
        .unwrap();

    Ok(())
}

fn read_layers(layers_file: &str) -> anyhow::Result<Vec<LayerGroup>> {
    let layers_text = std::fs::read_to_string(layers_file)
        .map_err(|err| anyhow!("Failed to read \"{}\": {err}", layers_file))?;
    
    let mut root_layers: Vec<LayerGroupChild> = json5::from_str(&layers_text)
        .map_err(|err| anyhow!("Invalid layer root file at \"{}\": {err}", layers_file))?;

    root_layers.resolve(&mut LayerConfigContext {
        root: std::path::Path::new(layers_file).parent().unwrap_or_else(|| std::path::Path::new("/")),
        known_layer_ids: Default::default(),
        voxel_mappings: Default::default(),
        voxel_filters: Default::default(),
    }).map_err(|err| anyhow!("Failed to resolve layers: {err}"))?;

    let mut root_groups = Vec::with_capacity(root_layers.len());
    for root_layer in root_layers {
        match root_layer {
            LayerGroupChild::Group(group) => root_groups.push(group),
            LayerGroupChild::Layer(layer) => return Err(anyhow!("Top level of layer config must only contain groups (found \"{}\")", layer.id)),
            LayerGroupChild::Link { path } => panic!("Path has not been resolved: {path}"),
        }
    }
    Ok(root_groups)
}