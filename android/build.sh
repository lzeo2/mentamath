#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"
BUILD_DIR="$PROJECT_ROOT/build"
ANDROID_HOME="${ANDROID_HOME:-/home/leozhang/android-sdk}"
PLATFORM="$ANDROID_HOME/platforms/android-34/android.jar"
BUILD_TOOLS="$ANDROID_HOME/build-tools/36.0.0"
AAPT2="$ANDROID_HOME/bin/aapt2"
ZIPALIGN="$ANDROID_HOME/bin/zipalign"
D8="$BUILD_TOOLS/d8"
APKSIGNER="$BUILD_TOOLS/apksigner"

rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"
mkdir -p "$BUILD_DIR/classes"

echo "=== 1. aapt2 compile resources ==="
"$AAPT2" compile -o "$BUILD_DIR/res.zip" --dir "$PROJECT_ROOT/res"

echo "=== 2. aapt2 link ==="
"$AAPT2" link \
    -o "$BUILD_DIR/unsigned.apk" \
    -I "$PLATFORM" \
    --manifest "$PROJECT_ROOT/AndroidManifest.xml" \
    -A "$PROJECT_ROOT/assets" \
    --java "$BUILD_DIR/r" \
    "$BUILD_DIR/res.zip"

echo "=== 3. javac ==="
javac --release 17 \
    -classpath "$PLATFORM" \
    -d "$BUILD_DIR/classes" \
    "$PROJECT_ROOT/src/com/mentamath/app/MainActivity.java"

echo "=== 4. jar classes ==="
cd "$BUILD_DIR/classes"
jar cf "$BUILD_DIR/classes.jar" .
cd "$PROJECT_ROOT"

echo "=== 5. d8 ==="
if [ -x "$D8" ]; then
    "$D8" --output "$BUILD_DIR" "$BUILD_DIR/classes.jar"
else
    # fallback to java -cp
    D8_JAR=$(ls "$BUILD_TOOLS"/d8*.jar 2>/dev/null | head -n1)
    if [ -z "$D8_JAR" ]; then
        echo "d8 jar not found in $BUILD_TOOLS"
        exit 1
    fi
    java -cp "$D8_JAR" com.android.tools.r8.D8 --output "$BUILD_DIR" "$BUILD_DIR/classes.jar"
fi

echo "=== 6. Add classes.dex to APK ==="
zip -j "$BUILD_DIR/unsigned.apk" "$BUILD_DIR/classes.dex"

echo "=== 7. zipalign ==="
"$ZIPALIGN" -f 4 "$BUILD_DIR/unsigned.apk" "$BUILD_DIR/aligned.apk"

echo "=== 8. keystore (persistent — created once, reused every build) ==="
KEYSTORE="$PROJECT_ROOT/keystore/mentamath.keystore"
if [ ! -f "$KEYSTORE" ]; then
    mkdir -p "$PROJECT_ROOT/keystore"
    keytool -genkeypair \
        -keystore "$KEYSTORE" \
        -alias mentamath \
        -storepass mentamath \
        -keypass mentamath \
        -dname "CN=Mentamath" \
        -keyalg RSA \
        -validity 10000
    echo "generated new keystore (new app identity)"
else
    echo "reusing existing keystore (stable signature → updates install cleanly)"
fi

echo "=== 9. apksigner sign ==="
if [ -x "$APKSIGNER" ]; then
    "$APKSIGNER" sign \
        --ks "$KEYSTORE" \
        --ks-pass pass:mentamath \
        --v1-signing-enabled true \
        --v2-signing-enabled true \
        --v3-signing-enabled true \
        --out /home/leozhang/mentamath/mentamath.apk \
        "$BUILD_DIR/aligned.apk"
else
    # fallback to java -cp
    APKSIGNER_JAR=$(ls "$BUILD_TOOLS"/apksigner*.jar 2>/dev/null | head -n1)
    if [ -z "$APKSIGNER_JAR" ]; then
        echo "apksigner jar not found in $BUILD_TOOLS"
        exit 1
    fi
    java -cp "$APKSIGNER_JAR" com.android.apksigner.ApkSignerTool sign \
        --ks "$KEYSTORE" \
        --ks-pass pass:mentamath \
        --v1-signing-enabled true \
        --v2-signing-enabled true \
        --v3-signing-enabled true \
        --out /home/leozhang/mentamath/mentamath.apk \
        "$BUILD_DIR/aligned.apk"
fi

echo "=== Build complete: /home/leozhang/mentamath/mentamath.apk ==="
