FROM ghcr.io/developmentseed/titiler:0.21.1

COPY colormaps/ /app/colormaps/

# Disable unused endpoints.
ENV TITILER_API_DISABLE_STAC=true
ENV TITILER_API_DISABLE_MOSAIC=true
ENV TITILER_API_WORKERS_PER_CORE=1

# Add custom colormaps.
ENV COLORMAP_DIRECTORY=/app/colormaps/

# Support only geoTIFFs.
ENV CPL_VSIL_CURL_ALLOWED_EXTENSIONS=.tif

# K8s-optimized environment variables.
# See https://github.com/developmentseed/titiler/tree/1208a67ee76b5057a9a4a3dca93ff875907e9812/deployment/k8s
ENV CPL_TMPDIR=/tmp
ENV GDAL_CACHEMAX=200
ENV VSI_CACHE=true
ENV VSI_CACHE_SIZE=5000000
ENV GDAL_DISABLE_READDIR_ON_OPEN=EMPTY_DIR
ENV GDAL_HTTP_MERGE_CONSECUTIVE_RANGES=YES
ENV GDAL_HTTP_MULTIPLEX=YES
ENV GDAL_HTTP_VERSION=2
ENV PYTHONWARNINGS=ignore

RUN addgroup --system app \
 && adduser --system --ingroup app app \
 && chown -R app:app /app
USER app

CMD ["uvicorn", "titiler.application.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "8"]
