"""create room_code_state

Revision ID: 0004
Revises: 0003
Create Date: 2026-11-11 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0004'
down_revision: Union[str, Sequence[str], None] = '0003'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('room_code_state',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('room_id', sa.Uuid(), nullable=False),
    sa.Column('content', sa.Text(), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['room_id'], ['rooms.id'], name=op.f('fk_room_code_state_room_id_rooms'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_room_code_state')),
    sa.UniqueConstraint('room_id', name='uq_room_code_state_room_id')
    )
    # Backfill one empty current-code row per pre-existing room (SPEC §6).
    op.execute(
        "INSERT INTO room_code_state (id, room_id, content) "
        "SELECT gen_random_uuid(), id, '' FROM rooms"
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('room_code_state')
