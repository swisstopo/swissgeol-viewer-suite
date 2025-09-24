fn main() {
    let colormap_dir_path = std::env::var("COLORMAP_DIR_PATH").unwrap_or_else(|_| "../titiler/colormaps".to_string());
    println!("cargo:rustc-env=COLORMAP_DIR_PATH={colormap_dir_path}");
}