#[allow(
    clippy::expect_used,
    reason = "a build script that cannot generate code must fail"
)]
fn main() {
    prost_build::Config::new()
        .out_dir("./src/proto")
        .compile_protos(
            &["../proto/signaling.proto", "../proto/reliable.proto"],
            &["../proto"],
        )
        .expect("Failed to compile .proto files");

    println!("cargo:rerun-if-changed=proto/");
}
