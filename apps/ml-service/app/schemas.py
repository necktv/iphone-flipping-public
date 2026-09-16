from pydantic import BaseModel, Field
from typing import Optional

class ValuationRequest(BaseModel):
    model: str
    storageGb: Optional[int] = 128
    batteryHealthPct: Optional[int] = 85
    condition: str = "GOOD"
    hasOriginalBox: bool = False
    hasReceiptOrInvoice: bool = False
    isLocked: bool = False
    listingPrice: float

class ValuationResponse(BaseModel):
    fairValue: float
    quickSaleValue: float
    estimatedProfit: float
    roiPercentage: float
    confidenceScore: float
    riskScore: float
    modelVersion: str = "python-ml-v1-baseline"
