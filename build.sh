#!/usr/bin/env bash
# exit on error
set -o errexit

# Install Python dependencies
pip install --upgrade pip
pip install -r requirements.txt

# Install ffmpeg locally
echo "Installing ffmpeg..."
mkdir -p bin
curl -L https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-linux64-gpl.tar.xz -o ffmpeg.tar.xz
tar -xf ffmpeg.tar.xz
# Move binaries to bin folder (strip the directory structure)
mv ffmpeg-master-latest-linux64-gpl/bin/ffmpeg bin/
mv ffmpeg-master-latest-linux64-gpl/bin/ffprobe bin/
# Cleanup
rm -rf ffmpeg-master-latest-linux64-gpl ffmpeg.tar.xz
chmod +x bin/ffmpeg bin/ffprobe

# Add bin to PATH
export PATH=$PATH:$(pwd)/bin
echo "ffmpeg installed to $(pwd)/bin"
