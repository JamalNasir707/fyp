class Place {
  final String id;
  final String name;
  final double latitude;
  final double longitude;
  final double cost;
  final double matchScore;
  const Place({
    required this.id,
    required this.name,
    required this.latitude,
    required this.longitude,
    required this.cost,
    required this.matchScore,
  });
  factory Place.fromJson(Map<String, dynamic> j) => Place(
        id: j['id'] as String,
        name: j['name'] as String,
        latitude: (j['latitude'] as num).toDouble(),
        longitude: (j['longitude'] as num).toDouble(),
        cost: (j['cost'] as num).toDouble(),
        matchScore: (j['matchScore'] as num).toDouble(),
      );
  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'latitude': latitude,
        'longitude': longitude,
        'cost': cost,
        'matchScore': matchScore,
      };
}
