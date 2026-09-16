from fastapi import FastAPI
from app.schemas import ValuationRequest, ValuationResponse

app = FastAPI(title="iPhone Pricing & Valuation ML Microservice", version="1.0.0")

BASE_PRICES = {
    "IPHONE_11": 220.0,
    "IPHONE_12": 300.0,
    "IPHONE_13": 440.0,
    "IPHONE_13_PRO": 560.0,
    "IPHONE_14": 540.0,
    "IPHONE_14_PRO": 720.0,
    "IPHONE_15": 680.0,
    "IPHONE_15_PRO": 920.0,
}

@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "ml-service"}

@app.post("/api/predict-valuation", response_model=ValuationResponse)
def predict_valuation(req: ValuationRequest):
    base_price = BASE_PRICES.get(req.model.upper(), 350.0)
    
    # Moltiplicatore memoria
    storage = req.storageGb or 128
    if storage > 128:
        base_price += (storage - 128) * 0.4

    # Moltiplicatore batteria
    if req.batteryHealthPct and req.batteryHealthPct < 80:
        base_price *= 0.85
    elif req.batteryHealthPct and req.batteryHealthPct >= 95:
        base_price *= 1.05

    # Moltiplicatore condizioni
    cond = req.condition.upper()
    if cond == "NEW_SEALED": base_price *= 1.20
    elif cond == "LIKE_NEW": base_price *= 1.08
    elif cond == "FAIR": base_price *= 0.80
    elif cond == "FOR_PARTS_DAMAGED": base_price *= 0.40

    if req.hasOriginalBox: base_price += 15.0
    if req.hasReceiptOrInvoice: base_price += 15.0

    fair_val = round(base_price, 2)
    quick_val = round(fair_val * 0.88, 2)

    fees_shipping = 15.0
    profit = round(quick_val - req.listingPrice - fees_shipping, 2)
    roi = round((profit / req.listingPrice) * 100, 2) if req.listingPrice > 0 else 0.0

    risk = 0.1
    if req.isLocked: risk += 0.7
    if cond == "FOR_PARTS_DAMAGED": risk += 0.5

    return ValuationResponse(
        fairValue=fair_val,
        quickSaleValue=quick_val,
        estimatedProfit=profit,
        roiPercentage=roi,
        confidenceScore=0.85,
        riskScore=min(risk, 1.0),
        modelVersion="python-fastapi-v1"
    )
