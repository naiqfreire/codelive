"""create code_versions

Revision ID: 0005
Revises: 0004
Create Date: 2026-11-13 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0005'
down_revision: Union[str, Sequence[str], None] = '0004'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('code_versions',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('room_id', sa.Uuid(), nullable=False),
    sa.Column('content', sa.Text(), nullable=False),
    sa.Column('language', sa.String(length=20), nullable=False),
    sa.Column('author_id', sa.Uuid(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['room_id'], ['rooms.id'], name=op.f('fk_code_versions_room_id_rooms'), ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['author_id'], ['users.id'], name=op.f('fk_code_versions_author_id_users'), ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_code_versions'))
    )
    op.create_index(op.f('ix_code_versions_created_at'), 'code_versions', ['created_at'])
    op.create_index('ix_code_versions_room_id_created_at', 'code_versions', ['room_id', sa.text('created_at DESC')])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('code_versions')
