#!/bin/bash
set -euo pipefail

INSTANCE_NAME="tesseract-sovereign"
COMPARTMENT_ID="${OCI_COMPARTMENT_ID}"
IMAGE_TAG="${DOCKER_IMAGE_TAG:-latest}"

echo "=== Tesseract Sovereign Oracle Deployment ==="
echo "Instance: $INSTANCE_NAME"
echo "Image Tag: $IMAGE_TAG"
echo "Timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)"

echo "[1/5] Building Docker image..."
docker build -t tesseract-sovereign:$IMAGE_TAG -f Dockerfile.oracle .

echo "[2/5] Tagging for registry..."
docker tag tesseract-sovereign:$IMAGE_TAG ${OCI_REGISTRY}/tesseract-sovereign:$IMAGE_TAG

echo "[3/5] Pushing to OCI registry..."
docker push ${OCI_REGISTRY}/tesseract-sovereign:$IMAGE_TAG

echo "[4/5] Updating instance..."
oci container-instances container-instance update \
  --container-instance-id ${OCI_INSTANCE_ID} \
  --containers "[{\"imageUrl\": \"${OCI_REGISTRY}/tesseract-sovereign:$IMAGE_TAG\"}]"

echo "[5/5] Verifying deployment..."
sleep 10
HEALTH=$(curl -sf http://${INSTANCE_IP}:3000/api/monitor/system | jq -r '.metrics[0].status')
if [ "$HEALTH" = "healthy" ]; then
  echo "Deployment successful — system healthy"
else
  echo "WARNING: Health check returned: $HEALTH"
fi

echo "=== Deployment Complete ==="
