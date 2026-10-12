"""Recording, channel, event set, and sensor configuration repositories."""

from __future__ import annotations

from typing import Any

from app.db.pool import Connection
from app.repositories._shared import clean, cursor_where, paginate, to_jsonb, to_model, to_models
from app.schemas.recordings import (
    Channel,
    ChannelList,
    EventSet,
    EventSetList,
    Recording,
    SensorConfiguration,
)
from app.scientific.adapters import (
    ChannelMeta,
    EventSetMeta,
    RecordingMeta,
    SensorConfigMeta,
)


async def create_recording(
    conn: Connection, meta: RecordingMeta, *, dataset_version_id: str
) -> Recording:
    row = await conn.execute(
        """
        INSERT INTO recordings
            (dataset_version_id, name, format, acquisition_system, device_serial,
             manufacturer, duration_s, sampling_frequency_hz, n_channels,
             maxfilter_sss_applied, coordinate_frame)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING *
        """,
        (
            dataset_version_id,
            meta.name,
            meta.format,
            meta.acquisition_system,
            meta.device_serial,
            meta.manufacturer,
            meta.duration_s,
            meta.sampling_frequency_hz,
            meta.n_channels,
            meta.maxfilter_sss_applied,
            meta.coordinate_frame,
        ),
    )
    recording = to_model(Recording, await row.fetchone())
    assert recording is not None
    return recording


async def get_recording_by_id(conn: Connection, recording_id: str) -> Recording | None:
    row = await conn.execute(
        """
        SELECT r.*,
               (SELECT COALESCE(array_agg(c.name), '{}')
                FROM channels c WHERE c.recording_id = r.id AND c.status = 'bad')
               AS bad_channel_names
        FROM recordings r WHERE r.id = %s
        """,
        (recording_id,),
    )
    return to_model(Recording, await row.fetchone())


async def get_recording_with_project(conn: Connection, recording_id: str) -> dict[str, Any] | None:
    """Recording joined to its dataset version, dataset, and project for authz."""
    row = await conn.execute(
        """
        SELECT r.id AS recording_id, r.*,
               dv.id AS dataset_version_id, dv.dataset_id, ds.project_id
        FROM recordings r
        JOIN dataset_versions dv ON dv.id = r.dataset_version_id
        JOIN datasets ds ON ds.id = dv.dataset_id
        WHERE r.id = %s
        """,
        (recording_id,),
    )
    result = await row.fetchone()
    return clean(result) if result else None


async def list_recordings_for_dataset_version(
    conn: Connection, dataset_version_id: str
) -> list[Recording]:
    row = await conn.execute(
        """
        SELECT r.*,
               (SELECT COALESCE(array_agg(c.name), '{}')
                FROM channels c WHERE c.recording_id = r.id AND c.status = 'bad')
               AS bad_channel_names
        FROM recordings r WHERE r.dataset_version_id = %s
        ORDER BY r.created_at DESC, r.id ASC
        """,
        (dataset_version_id,),
    )
    return to_models(Recording, await row.fetchall())


async def create_channels(conn: Connection, recording_id: str, channels: list[ChannelMeta]) -> None:
    rows = [
        (
            recording_id,
            channel.name,
            channel.group_name,
            channel.type,
            channel.unit,
            channel.unit_mul,
            channel.status,
            channel.coil_type,
            channel.position_mm[0] if channel.position_mm else None,
            channel.position_mm[1] if channel.position_mm else None,
            channel.position_mm[2] if channel.position_mm else None,
            channel.orientation[0] if channel.orientation else None,
            channel.orientation[1] if channel.orientation else None,
            channel.orientation[2] if channel.orientation else None,
            channel.opm_scalar,
            channel.opm_vector,
        )
        for channel in channels
    ]
    async with conn.cursor() as cur:
        await cur.executemany(
            """
            INSERT INTO channels
                (recording_id, name, group_name, type, unit, unit_mul, status, coil_type,
                 position_x_mm, position_y_mm, position_z_mm,
                 orientation_x, orientation_y, orientation_z, opm_scalar, opm_vector)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (recording_id, name) DO NOTHING
            """,
            rows,
        )


async def list_channels(
    conn: Connection,
    *,
    recording_id: str,
    limit: int,
    cursor: str | None,
    channel_type: str | None = None,
    status: str | None = None,
    channel_ids: list[str] | None = None,
) -> tuple[list[Channel], int, str | None, bool]:
    clauses: list[str] = ["c.recording_id = %s"]
    params: list[Any] = [recording_id]
    if channel_type:
        clauses.append("c.type = ANY(%s)")
        params.append(
            list(channel_type.split(",")) if isinstance(channel_type, str) else channel_type
        )
    if status:
        clauses.append("c.status = %s")
        params.append(status)
    if channel_ids:
        clauses.append("c.name = ANY(%s)")
        params.append(channel_ids)

    count_row = await conn.execute(
        f"SELECT count(*) AS n FROM channels c WHERE {' AND '.join(clauses)}",
        params,
    )
    count_result = await count_row.fetchone()
    total = int(count_result["n"])  # type: ignore[index]

    condition, cursor_params = cursor_where(cursor, "c")
    sql = f"""
        SELECT c.* FROM channels c
        WHERE {" AND ".join(clauses)} {condition}
        ORDER BY c.created_at DESC, c.id ASC
        LIMIT %s
    """
    row = await conn.execute(sql, [*params, *cursor_params, limit + 1])
    channels = to_models(Channel, await row.fetchall())
    page, next_cursor, has_more = paginate(channels, limit)
    return page, total, next_cursor, has_more


async def count_channels(conn: Connection, recording_id: str) -> int:
    row = await conn.execute(
        "SELECT count(*) AS n FROM channels WHERE recording_id = %s",
        (recording_id,),
    )
    result = await row.fetchone()
    return int(result["n"])  # type: ignore[index]


async def create_sensor_configuration(
    conn: Connection, recording_id: str, config: SensorConfigMeta
) -> SensorConfiguration:
    row = await conn.execute(
        """
        INSERT INTO sensor_configurations
            (recording_id, sensor_type, coordinate_frame, positions_json,
             orientations_json, calibrations_json, movement_ref, time_varying)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING *
        """,
        (
            recording_id,
            config.sensor_type,
            config.coordinate_frame,
            to_jsonb(config.positions_json or {}),
            to_jsonb(config.orientations_json or {}),
            to_jsonb(config.calibrations_json),
            config.movement_ref,
            config.time_varying,
        ),
    )
    result = await row.fetchone()
    assert result is not None
    sensors = [
        {
            "name": sensor.name,
            "type": sensor.type,
            "channel_names": sensor.channel_names,
            "position_mm": sensor.position_mm,
            "orientation": sensor.orientation,
            "calibration": sensor.calibration,
        }
        for sensor in config.sensors
    ]
    payload = clean(result)
    payload["sensors"] = sensors
    payload["length_unit"] = "mm"
    return SensorConfiguration.model_validate(payload)


async def get_sensor_configuration_by_id(
    conn: Connection, sensor_configuration_id: str
) -> SensorConfiguration | None:
    row = await conn.execute(
        "SELECT * FROM sensor_configurations WHERE id = %s",
        (sensor_configuration_id,),
    )
    result = await row.fetchone()
    if result is None:
        return None
    payload = clean(result)
    payload["sensors"] = []
    payload["length_unit"] = "mm"
    return SensorConfiguration.model_validate(payload)


async def get_sensor_configuration(
    conn: Connection, recording_id: str
) -> SensorConfiguration | None:
    row = await conn.execute(
        "SELECT * FROM sensor_configurations WHERE recording_id = %s",
        (recording_id,),
    )
    result = await row.fetchone()
    if result is None:
        return None
    payload = clean(result)
    payload["sensors"] = []
    payload["length_unit"] = "mm"
    return SensorConfiguration.model_validate(payload)


async def create_event_set(
    conn: Connection, recording_id: str, event_set: EventSetMeta
) -> EventSet:
    row = await conn.execute(
        """
        INSERT INTO event_sets
            (recording_id, name, source, sample_convention, event_count, description, metadata)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        RETURNING *
        """,
        (
            recording_id,
            event_set.name,
            event_set.source,
            event_set.sample_convention,
            len(event_set.events),
            event_set.description,
            to_jsonb(event_set.metadata or {}),
        ),
    )
    result = await row.fetchone()
    assert result is not None
    payload = clean(result)
    payload["events"] = [
        {
            "sample": event.sample,
            "time_s": event.time_s,
            "code": event.code,
            "value": event.value,
            "description": event.description,
        }
        for event in event_set.events
    ]
    return EventSet.model_validate(payload)


async def list_event_sets(
    conn: Connection,
    *,
    recording_id: str,
    limit: int,
    cursor: str | None,
    source: str | None = None,
) -> tuple[list[EventSet], int, str | None, bool]:
    clauses: list[str] = ["es.recording_id = %s"]
    params: list[Any] = [recording_id]
    if source:
        clauses.append("es.source = %s")
        params.append(source)

    count_row = await conn.execute(
        f"SELECT count(*) AS n FROM event_sets es WHERE {' AND '.join(clauses)}",
        params,
    )
    count_result = await count_row.fetchone()
    total = int(count_result["n"])  # type: ignore[index]

    condition, cursor_params = cursor_where(cursor, "es")
    sql = f"""
        SELECT es.* FROM event_sets es
        WHERE {" AND ".join(clauses)} {condition}
        ORDER BY es.created_at DESC, es.id ASC
        LIMIT %s
    """
    row = await conn.execute(sql, [*params, *cursor_params, limit + 1])
    rows = await row.fetchall()
    event_sets: list[EventSet] = []
    for raw in rows:
        payload = clean(raw)
        payload["events"] = None
        event_sets.append(EventSet.model_validate(payload))
    page, next_cursor, has_more = paginate(event_sets, limit)
    return page, total, next_cursor, has_more


async def get_event_set_with_events(conn: Connection, event_set_id: str) -> EventSet | None:
    row = await conn.execute("SELECT * FROM event_sets WHERE id = %s", (event_set_id,))
    result = await row.fetchone()
    if result is None:
        return None
    payload = clean(result)
    payload["events"] = None
    return EventSet.model_validate(payload)


async def store_event_payload(
    conn: Connection, event_set_id: str, events: list[dict[str, Any]]
) -> None:
    """Persist the full event array in the event set metadata JSONB column."""
    await conn.execute(
        "UPDATE event_sets SET metadata = jsonb_set(metadata, '{events}', %s::jsonb) WHERE id = %s",
        (__import__("json").dumps(events), event_set_id),
    )


_ = ChannelList, EventSetList
