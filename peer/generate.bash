#!/bin/bash
set -e

protoc --ts_out=src --experimental_allow_proto3_optional --ts_opt=client_generic --proto_path proto/v1 ./proto/v1/signaling.proto
node ./scripts/patch.cjs
sed -i '1s;^;// @ts-nocheck\n;' ./src/google/protobuf/timestamp.ts
