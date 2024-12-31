FROM mcr.microsoft.com/playwright:v1.49.1-noble

WORKDIR /app
RUN apt update && apt install -y make
COPY . .
RUN make install
ENTRYPOINT ["make", "e2e"]
