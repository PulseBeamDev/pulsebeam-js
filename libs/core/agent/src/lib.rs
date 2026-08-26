mod proto;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
extern "C" {
    pub fn alert(s: &str);
}

#[wasm_bindgen]
pub fn greet(name: &str) {
    let intent = proto::signaling::ClientIntent::default();
    alert(&format!("Hello, {}: {:?}!", name, intent));
}
