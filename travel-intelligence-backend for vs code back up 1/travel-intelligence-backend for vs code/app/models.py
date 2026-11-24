from typing import List, Optional
from pydantic import BaseModel, Field


class OptimizeRequest(BaseModel):
    max_budget: float = Field(..., description="Maximum total budget for selected locations")
    province: str = Field(..., description="Province filter for location selection")
    start_lat: float = Field(..., description="Starting latitude for route")
    start_lon: float = Field(..., description="Starting longitude for route")
    max_travel_hours: float = Field(..., description="Maximum combined travel + visit hours allowed")
    preferred_categories: List[str] = Field(default_factory=list, description="Preferred categories to boost")
    score_weight: float = Field(1, description="Weight for total score in utility")
    time_weight: float = Field(0.05, description="Weight for total time in utility")
    cost_weight: float = Field(0.01, description="Weight for total cost in utility")
    use_live_data: bool = Field(False, description="Whether to include API-fetched dynamic locations")
    avoid_crowds: bool = Field(False, description="Exclude crowded places (markets, malls, stadiums, food streets)")
    # New questionnaire fields
    budget_level: Optional[str] = Field(None, description="Low, Medium, High")
    trip_duration_level: Optional[str] = Field(None, description="1 Day, 2-3 Days, 4-7 Days")
    companions: Optional[str] = Field(None, description="Solo, Friends, Family")
    travel_style: Optional[str] = Field(None, description="Relaxation, Adventure, Cultural, Mixed")
    personality: Optional[str] = Field(None, description="Introvert, Extrovert")
    environment: Optional[str] = Field(None, description="Mountains, City, Historical, Nature")
    crowd_preference: Optional[str] = Field(None, description="Avoid crowds, Neutral, Enjoy crowds")


class Coordinate(BaseModel):
    lat: float
    lon: float


class SequenceOptions(BaseModel):
    algorithm: str = Field("nearest_neighbor", description="Ordering algorithm identifier")
    returnToStart: bool = Field(False, description="Whether to return to start when computing distance")
    speedKmh: float = Field(30.0, description="Speed used to convert km to hours for estimates")
    roadAware: bool = Field(False, description="If true, also compute road-based legs/metrics using OSRM when available")


class SequenceLocation(BaseModel):
    id: str
    name: Optional[str] = None
    lat: float
    lon: float


class SequenceDayRequest(BaseModel):
    tripId: Optional[str] = None
    dayId: str
    start: Optional[Coordinate] = None
    options: Optional[SequenceOptions] = None
    locations: List[SequenceLocation]


class SequenceMetrics(BaseModel):
    beforeDistanceKm: Optional[float] = None
    totalDistanceKm: float
    distanceSavedKm: Optional[float] = None
    beforeTravelTimeHours: Optional[float] = None
    estimatedTravelTimeHours: float
    travelTimeSavedHours: Optional[float] = None
    speedKmhUsed: float


class SequenceAlgorithmInfo(BaseModel):
    name: str
    fallbackUsed: bool = False


class SequenceLeg(BaseModel):
    fromPlaceId: str
    toPlaceId: str
    fromName: Optional[str] = None
    toName: Optional[str] = None
    distanceKm: float
    estimatedTravelTimeHours: float
    estimatedTravelTimeMin: int


class SequenceTruthInfo(BaseModel):
    source: str
    distanceModel: str
    timeModel: str
    roadAware: bool = False


class SequenceDayResponse(BaseModel):
    dayId: str
    order: Optional[List[str]] = None
    metrics: Optional[SequenceMetrics] = None
    legs: List[SequenceLeg] = Field(default_factory=list)
    algorithm: Optional[SequenceAlgorithmInfo] = None
    truth: Optional[SequenceTruthInfo] = None
    warnings: List[str] = Field(default_factory=list)
    errors: List[str] = Field(default_factory=list)
