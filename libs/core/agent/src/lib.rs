mod proto;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
extern "C" {
    pub fn alert(s: &str);
}

#[wasm_bindgen]
pub fn greet(name: &str) {
    let intent = proto::signaling::ClientIntent::default();
    let msg = format!("Hello, {}: {:?}!", name, intent);
    let compressed = lz4_flex::compress(msg.as_bytes());
    let decompressed = lz4_flex::decompress(&compressed, 0).unwrap();
    let msg = String::from_utf8(decompressed).unwrap();

    alert(&msg);
}
