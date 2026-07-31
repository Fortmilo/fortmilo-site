$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$siteRoot = Split-Path -Parent $PSScriptRoot
$sourcePath = Join-Path $siteRoot "assets\fortmilo-brand-banner-1200x675.png"
$outputPath = Join-Path $siteRoot "assets\fortmilo-security-observatory-og-20260731.jpg"

$source = [System.Drawing.Image]::FromFile($sourcePath)
try {
    if ($source.Width -ne 1200 -or $source.Height -ne 675) {
        throw "Approved banner must be exactly 1200x675 pixels."
    }

    $output = [System.Drawing.Bitmap]::new(
        1200,
        630,
        [System.Drawing.Imaging.PixelFormat]::Format24bppRgb
    )
    try {
        $graphics = [System.Drawing.Graphics]::FromImage($output)
        try {
            $graphics.Clear([System.Drawing.Color]::FromArgb(7, 16, 29))
            $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
            $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
            $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
            $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
            $graphics.DrawImage(
                $source,
                [System.Drawing.Rectangle]::new(0, 0, 1200, 630),
                [System.Drawing.Rectangle]::new(0, 22, 1200, 630),
                [System.Drawing.GraphicsUnit]::Pixel
            )

            $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceOver
            $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
            $font = [System.Drawing.Font]::new(
                "Segoe UI",
                42,
                [System.Drawing.FontStyle]::Regular,
                [System.Drawing.GraphicsUnit]::Pixel
            )
            $brush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::White)
            try {
                $graphics.DrawString("Security Observatory", $font, $brush, 455, 395)
            }
            finally {
                $brush.Dispose()
                $font.Dispose()
            }
        }
        finally {
            $graphics.Dispose()
        }

        $jpegCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
            Where-Object { $_.MimeType -eq "image/jpeg" } |
            Select-Object -First 1
        $quality = [System.Drawing.Imaging.EncoderParameter]::new(
            [System.Drawing.Imaging.Encoder]::Quality,
            [long]90
        )
        $encoderParameters = [System.Drawing.Imaging.EncoderParameters]::new(1)
        try {
            $encoderParameters.Param[0] = $quality
            $output.Save($outputPath, $jpegCodec, $encoderParameters)
        }
        finally {
            $quality.Dispose()
            $encoderParameters.Dispose()
        }
    }
    finally {
        $output.Dispose()
    }
}
finally {
    $source.Dispose()
}

Write-Output "Generated $outputPath from the approved 1200x675 FortMilo banner."
