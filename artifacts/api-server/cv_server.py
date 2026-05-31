import uvicorn
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional
import re
import traceback

# Import the core CV engine
from braille_cv_engine import execute_braille_cv_pipeline

app = FastAPI(
    title="BrailleVision CV OCR Engine",
    description="Deterministic OpenCV-based Braille segmentation and decoding service",
    version="1.0.0"
)

class BrailleProcessRequest(BaseModel):
    imageBase64: str
    mimeType: Optional[str] = "image/png"
    scanMode: Optional[str] = "auto"

@app.post("/api/cv/process")
async def process_braille(payload: BrailleProcessRequest):
    """
    Cleans incoming base64 payload data, forwards it to the OpenCV segmentation engine,
    and returns deterministic translation and coordinate maps.
    """
    try:
        raw_b64 = payload.imageBase64
        
        # Robustly strip base64 headers if present (e.g. data:image/png;base64,...)
        if "," in raw_b64:
            parts = raw_b64.split(",", 1)
            raw_b64 = parts[1]
            
        # Strip whitespaces, linebreaks or padding anomalies
        raw_b64 = re.sub(r"\s+", "", raw_b64)
        
        # Execute the OpenCV-based OCR pipeline
        result = execute_braille_cv_pipeline(raw_b64, payload.scanMode)
        
        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])
            
        return result
        
    except HTTPException as he:
        # Re-raise HTTP exceptions
        raise he
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Internal Server Error in CV Engine: {str(e)}")

if __name__ == "__main__":
    # Start the server on port 8000
    uvicorn.run(app, host="127.0.0.1", port=8000)
