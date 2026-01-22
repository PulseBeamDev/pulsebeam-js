PROTO_URL_BASE := https://raw.githubusercontent.com/PulseBeamDev/pulsebeam/refs/heads/main/pulsebeam-proto/proto
PROTO_DIR := proto
PROTOS := signaling.proto 
PROTO_FILES := $(addprefix $(PROTO_DIR)/, $(PROTOS))

all: $(PROTO_FILES)
$(PROTO_DIR)/%.proto:
	@mkdir -p $(PROTO_DIR)
	@echo "Downloading $*..."
	@curl -sSL $(PROTO_URL_BASE)/$*.proto > $@

clean:
	rm -rf $(PROTO_DIR)
