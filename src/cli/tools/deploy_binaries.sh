#!/usr/bin/env bash

if [[ -z "${TAG}" ]]; then
    echo "TAG environment variable is missing, aborting"
    exit 1
fi

for file in dist/*; do
    aws --profile "amazon-studios-creative-tech-backup" s3 cp "${file}" "s3://${BUCKET}/${TAG}/"
done
